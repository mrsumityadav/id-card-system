const express = require('express')
const router = express.Router()
const userModel = require('../models/user')
const jwt = require('jsonwebtoken')

router.get('/', function (req, res) {
  res.render('login')
})

router.post('/login', async function (req, res) {
  try {
    const { email, password } = req.body

    const user = await userModel.findOne({ email }).populate("schoolId")
    if (!user || user.password !== password) {
      return res.send('Invalid email or password')
    }

    // ✅ JWT CREATE
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        schoolId: user.schoolId?._id || null
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )

    // ✅ COOKIE SET
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24
    })

    // 🔥🔥 FIX STARTS HERE 🔥🔥

    // ✅ 1. SUPERADMIN = ALWAYS SEPARATE FLOW
    if (user.role === 'admin') {
      return res.redirect('/superAdmin')
    }

    // ✅ 2. FIRST LOGIN ONLY FOR NORMAL ADMIN
    if (user.isFirstLogin) {
      user.isFirstLogin = false
      await user.save()
      return res.redirect('/admin/setting')
    }

    // ✅ 3. NORMAL ADMIN DASHBOARD
    return res.redirect('/admin')

  } catch (err) {
    console.error(err)
    res.status(500).send('Server error')
  }
})

module.exports = router