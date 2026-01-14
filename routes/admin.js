const express = require('express')
const router = express.Router()
const userModel = require('../models/user')
const schoolModel = require('../models/school');
const Student = require('../models/student');
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const Class = require("../models/class");
const Section = require("../models/section");
const compressBase64Image = require("../utils/compressBase64");

async function seed() {
  const school = await schoolModel.findOne();
  if (!school) {
    console.log("❌ No school found");
    process.exit();
  }

  await Class.deleteMany({ schoolId: school._id });
  await Section.deleteMany({ schoolId: school._id });

  const classes = [
    "Play School", "Nursery", "LKG", "UKG",
    "1", "2", "3", "4", "5", "6",
    "7", "8", "9", "10", "11", "12"
  ];

  for (const cls of classes) {
    const classDoc = await Class.create({
      className: cls,
      schoolId: school._id
    });

    const sections = ["A", "B", "C", "D"];

    for (const sec of sections) {
      await Section.create({
        classId: classDoc._id,
        sectionName: sec,
        schoolId: school._id
      });
    }
  }

  console.log("✅ Classes & Sections seeded with schoolId");
  process.exit();
}
// 👉 ONE TIME RUN
// seed();

router.get('/', async function (req, res) {
  const school = await schoolModel.findOne({ ownerUserId: req.user._id });
  if (!school) return res.redirect("/admin/setting");

  const totalStudents = await Student.countDocuments({
    schoolId: school._id
  });

  const pendingCount = await Student.countDocuments({
    schoolId: school._id,
    status: "PENDING"
  });

  const submittedCount = await Student.countDocuments({
    schoolId: school._id,
    status: "SUBMITTED"
  });

  const latestStudents = await Student.find({
    schoolId: school._id
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate("classId", "className")
    .populate("sectionId", "sectionName")
    .lean();

  res.render('adminDash/admindashboard', {
    user: req.user,
    school,
    totalStudents,
    latestStudents,
    pendingCount,
    submittedCount
  });
});
router.get('/addStudent', async function (req, res) {
  try {
    const school = await schoolModel.findOne({ ownerUserId: req.user._id });
    if (!school) return res.redirect("/admin/setting");

    const classOrder = [
      "Play School", "Nursery", "LKG", "UKG",
      "1", "2", "3", "4", "5", "6",
      "7", "8", "9", "10", "11", "12"
    ];

    // 🔥 IMPORTANT: NO schoolId filter here
    const classes = await Class.find({}).lean();

    classes.sort(
      (a, b) => classOrder.indexOf(a.className) - classOrder.indexOf(b.className)
    );

    res.render("adminDash/addStudent", {
      school,
      classes
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading add student");
  }
});
router.post("/addStudent", upload.single("image"), async (req, res) => {
  try {
    const school = await schoolModel.findOne({
      ownerUserId: req.user._id
    });

    if (!school) return res.status(400).send("School not found");

    const {
      name, dob, fatherName, admissionNo,
      address, contactNumber, classId, sectionId, croppedImage
    } = req.body;

    if (!croppedImage) {
      return res.status(400).send("Image is required");
    }

    // 🔥 COMPRESS CROPPED IMAGE
    const compressedBuffer = await compressBase64Image(croppedImage);

    // 🔥 UPLOAD OPTIMIZED IMAGE
    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${compressedBuffer.toString("base64")}`,
      { folder: "school-assets" }
    );

    await Student.create({
      schoolId: school._id,
      name,
      dob,
      fatherName,
      admissionNo,
      address,
      contactNumber,
      classId,
      sectionId: sectionId || null,
      image: result.secure_url
    });

    res.redirect("/admin/addStudent");

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

router.get('/classes', async (req, res) => {
  try {
    const school = await schoolModel.findOne({
      ownerUserId: req.user._id
    })

    if (!school) {
      return res.render('adminDash/classes', { classes: [] })
    }
    const classes = await Class.find({}).lean()

    const result = await Promise.all(
      classes.map(async (cls) => {
        const totalStudents = await Student.countDocuments({
          classId: cls._id,
          schoolId: school._id
        })

        return {
          ...cls,
          totalStudents
        }
      })
    )

    res.render('adminDash/classes', {
      classes: result
    })

  } catch (err) {
    console.error(err)
    res.status(500).send('Something went wrong')
  }
})
router.get("/class/:classId", async (req, res) => {
  try {
    const { classId } = req.params
    const { section } = req.query

    // ✅ school correct way
    const school = await schoolModel.findOne({
      ownerUserId: req.user._id
    })

    if (!school) {
      return res.status(404).send("School not found")
    }

    // ✅ base filter
    const filter = {
      classId,
      schoolId: school._id
    }

    // ✅ section filter
    if (section && section !== "all") {
      const sec = await Section.findOne({
        classId,
        sectionName: section
      })
      if (sec) {
        filter.sectionId = sec._id
      }
    }

    const students = await Student.find(filter)
      .populate("classId", "className")
      .populate("sectionId", "sectionName")
      .sort({ name: 1 })

    const totalIds = students.length
    const pendingCount = students.filter(s => s.status === "PENDING").length
    const submittedCount = students.filter(s => s.status === "SUBMITTED").length

    const cls = await Class.findById(classId)

    res.render("adminDash/classPreview", {
      school,
      students,
      totalIds,
      pendingCount,
      submittedCount,
      classId,
      className: cls?.className || "Class",
      selectedSection: section || "all"
    })

  } catch (err) {
    console.error(err)
    res.status(500).send(err)
  }
})
router.post("/class/:classId/submit-all", async (req, res) => {
  try {
    const { classId } = req.params;

    await Student.updateMany(
      { classId, status: "PENDING" },
      { $set: { status: "SUBMITTED" } }
    );

    res.redirect(`/admin/class/${classId}`); // 👈 yahi magic hai

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

router.get('/setting', async function (req, res) {
  const templates = [
    { name: "template1", label: "Classic" },
    { name: "template2", label: "Modern Dark" },
    { name: "template3", label: "Minimal" }
  ];
  try {
    const user = await userModel
      .findById(req.user._id)
      .populate('schoolId');

    res.render('adminDash/setting', { user, school: user.schoolId, templates });
  } catch (err) {
    console.log(err);
    res.send(err);
  }
})
router.post("/select-template/:schoolId", async (req, res) => {
  await schoolModel.findByIdAndUpdate(req.params.schoolId, {
    selectedTemplate: req.body.template
  });
  res.redirect("/admin/setting");
});
router.post("/setting/:id", upload.fields([{ name: "logo", maxCount: 1 },]),
  async (req, res) => {
    try {
      const schoolId = req.params.id;

      const updateData = {
        name: req.body.name,
        address: req.body.address,
        pincode: req.body.pincode,
        state: req.body.state,
      };

      // 🟢 School logo
      if (req.files?.logo) {
        const result = await cloudinary.uploader.upload(
          `data:${req.files.logo[0].mimetype};base64,${req.files.logo[0].buffer.toString("base64")}`,
          { folder: "school-assets" }
        );
        updateData.logo = result.secure_url;
      }

      await schoolModel.findByIdAndUpdate(schoolId, updateData);
      res.redirect("/admin/setting");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  }
);
router.post("/upload-signature/:id", upload.single("principalSignature"), async (req, res) => {
  const result = await cloudinary.uploader.upload(
    `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
    { folder: "school-assets" }
  );

  await schoolModel.findByIdAndUpdate(req.params.id, {
    principalSignature: result.secure_url,
  });

  res.redirect("/admin/setting");
}
);

router.get('/students/:id/edit', async (req, res) => {
  try {
    const school = await schoolModel.findOne({ ownerUserId: req.user._id });
    if (!school) return res.redirect("/admin/dashboard");

    const student = await Student.findById(req.params.id)
      .populate("classId")
      .populate("sectionId");

    if (!student) return res.redirect("/admin/dashboard");

    let classes = await Class.find({});

    const sections = student.classId
      ? await Section.find({ classId: student.classId._id })
      : [];

    const classOrder = [
      "Play School", "Nursery", "LKG", "UKG",
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"
    ];

    classes.sort(
      (a, b) => classOrder.indexOf(a.className) - classOrder.indexOf(b.className)
    );

    res.render("adminDash/studentPreview", {
      school,
      student,
      classes,
      sections
    });

  } catch (err) {
    console.error(err);
    res.redirect("/admin/dashboard");
  }
});
router.post("/students/:id/edit", upload.single("image"),
  async (req, res) => {
    try {
      const school = await schoolModel.findOne({
        ownerUserId: req.user._id
      });

      if (!school) {
        return res.status(400).send("School not found");
      }

      const student = await Student.findById(req.params.id);
      if (!student) {
        return res.status(404).send("Student not found");
      }

      const {
        name,
        dob,
        fatherName,
        admissionNo,
        address,
        contactNumber,
        classId,
        sectionId,
        croppedImage,
        status
      } = req.body;

      if (!name || !dob || !fatherName || !address) {
        return res.status(400).send("Required fields missing");
      }

      /* ===============================
         IMAGE HANDLING (SAFE)
         =============================== */
      let imageUrl = student.image; // default → old image

      if (croppedImage && croppedImage.startsWith("data:image")) {
        const result = await cloudinary.uploader.upload(croppedImage, {
          folder: "school-assets"
        });

        imageUrl = result.secure_url;
      }

      /* ===============================
         UPDATE STUDENT
         =============================== */
      student.name = name;
      student.dob = dob;
      student.fatherName = fatherName;
      student.admissionNo = admissionNo;
      student.address = address;
      student.contactNumber = contactNumber;
      student.classId = classId || null;
      student.sectionId = sectionId || null;
      student.image = imageUrl;
      student.status = status

      await student.save();

      return res.redirect("/admin");

    } catch (err) {
      console.error(err);
      return res.status(500).send("Server error");
    }
  }
);
router.post("/students/:id/delete", async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});
router.get('/allStudent', async function (req, res) {
  const school = await schoolModel.findOne({ ownerUserId: req.user });
  const students = await Student.find({ schoolId: school._id })
    .populate({
      path: "classId",
      select: "className"
    })
    .populate({
      path: "sectionId",
      select: "sectionName"
    })

  const pendingCount = await Student.countDocuments({
    status: "PENDING"
  });
  const submittedCount = await Student.countDocuments({
    status: "SUBMITTED"
  });
  res.render('adminDash/allStudent', { school, students, pendingCount, submittedCount })
})

router.get('/logout', function (req, res) {
  res.cookie('token', '', { expires: new Date(0) })
  return res.redirect('/')
})

router.get("/sections/by-class/:classId", async (req, res) => {
  try {
    const { classId } = req.params;

    // 🔥 NO schoolId filter (model me nahi hai)
    const sections = await Section.find({ classId })
      .select("_id sectionName")
      .sort({ sectionName: 1 });

    res.json(sections);
  } catch (err) {
    console.error("Section fetch error:", err);
    res.status(500).json([]);
  }
});


module.exports = router