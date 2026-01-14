const jwt = require('jsonwebtoken')
const User = require('../models/user')

async function validateSuperAdmin(req, res, next) {
  try {
    const token = req.cookies.token
    if (!token) return res.redirect('/')

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.userId)
    if (!user) return res.redirect('/')

    if (user.role !== 'admin') {
      return res.status(403).send('Access Denied')
    }

    req.user = user
    next()
  } catch (err) {
    console.error('SuperAdmin middleware error:', err)
    return res.redirect('/')
  }
}

module.exports = validateSuperAdmin