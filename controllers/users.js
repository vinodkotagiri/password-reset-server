const Users = require('../models/user')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const SibApiV3Sdk = require('sib-api-v3-sdk')
const { nanoid } = require('nanoid')

// -----------------------------------------------------------------------------
// 						Get all the registered users
// -----------------------------------------------------------------------------
const getUsers = async (req, res) => {
	try {
		const users = await Users.find()
		res.status(200).send(users)
	} catch (error) {
		res
			.status(400)
			.send('An error occurred while getting users: ' + error.message)
	}
}

// -----------------------------------------------------------------------------
// 	 						Handle Login request
// -----------------------------------------------------------------------------
const login = async (req, res) => {
	//Get login details form client request
	const { email, password } = req.body

	//Get  the user exists
	const user = await Users.findOne({ email: email.toLowerCase() }).lean()

	//If user doesn't exists
	if (!user) {
		return res.status(404).json({
			error: `User with email '${email.toLowerCase()}' does not exist`,
		})
	}
	//IF Email exists
	//Verify the password
	const verify = await bcrypt.compare(password, user.password)

	//If password not matching
	if (!verify) {
		return res.status(401).json({ error: 'Unautohrized!, Invalid password' })
	}
	//If everything is good
	try {
		//Generate access token
		const accessToken = jwt.sign(
			{ _id: user._id, email: user.email },
			process.env.JWT_SECRET,
			{ expiresIn: '7d' }
		)

		res.status(200).json({
			user: {
				id: user._id,
				username: user.username,
				email: user.email,
			},
			token: accessToken,
		})
	} catch (error) {
		res.status(500).json({ error: 'Internal Error! Please try again later' })
	}
}

// -----------------------------------------------------------------------------
// 	 	 						Handle Register
// -----------------------------------------------------------------------------
const register = async (req, res) => {
	const { username, email, password } = req.body
	console.log(req.body)
	if (password.length < 6) {
		return res
			.status(400)
			.json({ error: 'Password length must be at least 6 characters' })
	}
	//Encrypt the password
	const encryptedPassword = await bcrypt.hashSync(password, 10)
	try {
		//Check if the user with email is already registered
		const check = await Users.findOne({ email: email.toLowerCase() }).lean()
		if (check) return res.status(400).send('Email already registered')

		const user = await new Users({
			username,
			password: encryptedPassword,
			email: email.toLowerCase(),
		})
		user.save()
		//Generate a JWT token
		const token = jwt.sign(
			{ _id: user._id, email: user._email },
			process.env.JWT_SECRET,
			{ expiresIn: '7d' }
		)
		const { password, ...rest } = user._doc
		res
			.status(201)
			.json({ user: { email: user.email, _id: user._id, token: token } })
	} catch (error) {
		res.status(400).send('An error occurred while registering: ' + error)
	}
}

// -----------------------------------------------------------------------------
// 	 	 	 					Handle forgot Password
// -----------------------------------------------------------------------------
const forgotPassword = async (req, res) => {
	const { email } = req.body
	const user = await Users.findOne({ email })
	if (!user) {
		res.status(400).json({ error: 'User not found!' })
		return
	}
	try {
		//Generate  unique reset code
		const resetCode = nanoid(6).toUpperCase()
		//Add code to the user db
		user.resetCode = resetCode
		user.save()
		sendResetEmail(email, resetCode)
		res.status(202).json({ user })
	} catch (error) {
		res.status(500).json({ error: 'Internal Server Error!' })
	}
}

// -----------------------------------------------------------------------------
// 					Handler for sending Mail with resetCode
// -----------------------------------------------------------------------------

function sendResetEmail(email, token) {
	//Create a new instance and api key
	const client = SibApiV3Sdk.ApiClient.instance
	const apiKey = client.authentications['api-key']
	apiKey.apiKey = process.env.SENDINBLUE_API

	//create new transaction email instance
	const mailOptions = new SibApiV3Sdk.TransactionalEmailsApi()

	//Specify the sender
	const sender = {
		email: 'mernfsd@gmail.com',
		name: 'Reset Mail',
	}
	//Specify the recipients
	const recipients = [
		{
			email: email,
		},
	]

	//Send the email
	mailOptions
		.sendTransacEmail({
			sender,
			to: recipients,
			subject: 'Your password reset code',
			htmlContent: `<p>Your password reset code is: <mark>${token}</mark></p>`,
		})
		.then(console.log)
		.catch(console.log)
}

// -----------------------------------------------------------------------------
// 	 	 	 	 					Reset the password
// -----------------------------------------------------------------------------
const resetPassword = async (req, res) => {
	const { password, resetCode } = req.body
	const user = await Users.findOne({ resetCode })
	if (!user) {
		res.status(400).json({ error: 'Rest Code is invalid!' })
		return
	}
	const newEncryptedPassword = await bcrypt.hash(password, 12)
	try {
		await user.updateOne({ password: newEncryptedPassword })
		res.status(200).json({ message: 'Password updated successfully!' })
	} catch (error) {
		res.status(500).json({ error: 'Intenal Server Error, Please try again!' })
	}
}

module.exports = { getUsers, register, forgotPassword, login, resetPassword }
