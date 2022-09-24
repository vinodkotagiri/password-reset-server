var express = require('express')
var router = express.Router()

const {
	getUsers,
	login,
	register,
	forgotPassword,
	resetPassword,
} = require('../controllers/users')
/* GET users listing. */
router.get('/', getUsers)
router.post('/login', login)
router.post('/register', register)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

module.exports = router
