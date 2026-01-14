const express = require('express');
const router = express.Router();
const userModel = require('../models/user');
const schoolModel = require('../models/school');

router.get('/', function (req, res) {
  res.render('signup');
});

router.post('/', async function (req, res) {
  try {
    const {
      name,
      email,
      password,
      phone,
      school,
      address,
      state,
      pincode
    } = req.body;

    // 1️⃣ Create User
    const user = await userModel.create({
      name,
      email,
      password,
      phone,
    });

    // 2️⃣ Create School (ownerUserId = user._id)
    const newSchool = await schoolModel.create({
      name: school,
      address,
      state,
      pincode,
      ownerUserId: user._id,
    });

    user.schoolId = newSchool._id;
    await user.save();

    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send("Signup failed");
  }
});

module.exports = router;