const jwt = require('jsonwebtoken')
const User = require('../models/user')
const School = require('../models/school')

async function validateAdmin(req, res, next) {
  try {
    const token = req.cookies.token
    if (!token) return res.redirect('/')

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.userId)
    if (!user) return res.redirect('/')

    req.user = user
    req.schoolId = user.schoolId

    let school = null
    if (user.schoolId) {
      school = await School.findById(user.schoolId)
    }

    res.locals.user = user
    res.locals.school = school
    res.locals.selectedTemplate = school?.selectedTemplate || 'template1'

    next()
  } catch (err) {
    console.error('Admin middleware error:', err)
    return res.redirect('/')
  }
}

module.exports = validateAdmin