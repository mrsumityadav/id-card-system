const express = require('express')
const mongoose = require("mongoose");
const router = express.Router()
const School = require("../models/school");
const User = require("../models/user");
const Student = require("../models/student");
const Class = require("../models/class");
const Section = require("../models/section"); // ✅ YE MISSING THA
function getPrintCart(req) {
    if (!req.session.printCart) {
        req.session.printCart = [];
    }
    return req.session.printCart;
}
router.post("/print/cart/clear", (req, res) => {
    req.session.printCart = [];
    res.json({ success: true });
});

router.get("/", async (req, res) => {
    try {
        const totalSchools = await School.countDocuments();
        const totalStudents = await Student.countDocuments();

        const pendingApprovalCount = await Student.countDocuments({
            status: "SUBMITTED"
        });

        const printedCount = await Student.countDocuments({
            status: "PRINTED"
        });

        // 🔥 latest 3 schools with stats
        const latestSchools = await School.find()
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();

        // 🔥 add student counts per school
        for (let school of latestSchools) {
            school.totalStudents = await Student.countDocuments({
                schoolId: school._id
            });

            school.submittedStudents = await Student.countDocuments({
                schoolId: school._id,
                status: "SUBMITTED"
            });
            school.printedtudents = await Student.countDocuments({
                schoolId: school._id,
                status: "PRINTED"
            });
        }

        res.render("superAdmin/superAdmin", {
            totalSchools,
            totalStudents,
            pendingApprovalCount,
            printedCount,
            latestSchools
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

router.get('/schools', async function (req, res) {
    try {
        const schools = await School.find()
            .sort({ createdAt: -1 })
            .lean();

        // 🔹 har school ke liye simple counts
        for (let school of schools) {
            school.totalStudents = await Student.countDocuments({
                schoolId: school._id
            });

            school.submittedStudents = await Student.countDocuments({
                schoolId: school._id,
                status: "SUBMITTED"
            });

            school.printedStudents = await Student.countDocuments({
                schoolId: school._id,
                status: "PRINTED"
            });
        }

        res.render("superAdmin/allSchool", {
            schools
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
})
router.get("/delete-school/:schoolId", async (req, res) => {
    try {
        const { schoolId } = req.params;

        // 🔎 school check
        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(404).send("School not found");
        }

        // 🧹 DELETE ORDER (important)
        await Student.deleteMany({ schoolId });
        await Section.deleteMany({ schoolId });
        await Class.deleteMany({ schoolId });
        await User.deleteOne({ _id: school.ownerUserId });
        await School.deleteOne({ _id: schoolId });

        res.redirect("/superadmin/schools");

    } catch (err) {
        console.error("Delete school error:", err);
        res.status(500).send("Server error");
    }
});

router.get("/students", async (req, res) => {
    try {
        const { schoolId, search, ajax } = req.query;

        let filter = {};

        if (schoolId) {
            filter.schoolId = schoolId;
        }

        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        const students = await Student.find(filter)
            .populate("schoolId", "name")
            .populate("classId", "className")
            .sort({ createdAt: -1 });

        // 🔥 AJAX request → JSON
        if (ajax === "true") {
            return res.json(students);
        }

        // normal page load
        const schools = await School.find().select("_id name");

        res.render("superAdmin/allStudent", {
            students,
            schools,
            selectedSchool: schoolId || "",
            searchText: search || ""
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

router.post("/print/cart/toggle", async (req, res) => {
    const { studentId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.json({ success: false });
    }

    const cart = getPrintCart(req);

    const index = cart.indexOf(studentId);
    if (index === -1) {
        cart.push(studentId); // add
    } else {
        cart.splice(index, 1); // remove
    }

    req.session.printCart = cart;
    res.json({ success: true, count: cart.length });
});
router.get('/print', async (req, res) => {
    try {
        const schools = await School.aggregate([
            {
                $lookup: {
                    from: "students",
                    localField: "_id",
                    foreignField: "schoolId",
                    as: "students"
                }
            },
            {
                $addFields: {
                    totalStudents: { $size: "$students" },
                    submittedCount: {
                        $size: {
                            $filter: {
                                input: "$students",
                                as: "s",
                                cond: { $eq: ["$$s.status", "SUBMITTED"] }
                            }
                        }
                    },
                    printedCount: {
                        $size: {
                            $filter: {
                                input: "$students",
                                as: "s",
                                cond: { $eq: ["$$s.status", "PRINTED"] }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    students: 0
                }
            }
        ]);

        res.render("superAdmin/printBatch", { schools });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});
router.get("/print/preview", async (req, res) => {
    try {
        const cart = getPrintCart(req);
        if (cart.length === 0) return res.send("No students selected");

        const students = await Student.find({
            _id: { $in: cart.map(id => new mongoose.Types.ObjectId(id)) }
        })
            .populate("classId")
            .populate("sectionId")
            .populate("schoolId");

        const school = students[0].schoolId;

        res.render("superAdmin/printPreview", {
            students,
            school,
            selectedTemplate: school.selectedTemplate,
            ids: cart
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});
router.get("/print/class/:classId", async (req, res) => {
    const selectedSection = req.query.section || "all";
    try {
        const { classId } = req.params;
        const { schoolId, section } = req.query;

        if (!schoolId) return res.status(400).send("SchoolId missing");

        const filter = {
            classId: new mongoose.Types.ObjectId(classId),
            schoolId: new mongoose.Types.ObjectId(schoolId),
            status: { $in: ["SUBMITTED", "PRINTED"] }
        };

        if (section && section !== "all") {
            const sec = await Section.findOne({ classId, sectionName: section });
            if (sec) filter.sectionId = sec._id;
        }

        const students = await Student.find(filter)
            .populate("sectionId")
            .sort({ status: 1, name: 1 });

        const cls = await Class.findById(classId);
        const school = await School.findById(schoolId);

        const cart = getPrintCart(req);

        res.render("superAdmin/printStudents", {
            students,
            cls,
            school,
            classId,
            schoolId,
            cart,
            selectedSection
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});
router.get('/print/:schoolId', async (req, res) => {
    try {
        const { schoolId } = req.params;

        const classes = await Class.aggregate([
            {
                $lookup: {
                    from: "students",
                    let: { classId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$classId", "$$classId"] },
                                        { $eq: ["$schoolId", new mongoose.Types.ObjectId(schoolId)] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "students"
                }
            },
            { $match: { "students.0": { $exists: true } } },
            {
                $addFields: {
                    totalStudents: { $size: "$students" },
                    submittedCount: {
                        $size: {
                            $filter: {
                                input: "$students",
                                as: "s",
                                cond: { $eq: ["$$s.status", "SUBMITTED"] }
                            }
                        }
                    },
                    printedCount: {
                        $size: {
                            $filter: {
                                input: "$students",
                                as: "s",
                                cond: { $eq: ["$$s.status", "PRINTED"] }
                            }
                        }
                    }
                }
            },
            { $project: { students: 0 } },
            { $sort: { className: 1 } }
        ]);

        res.render("superAdmin/printClasses", { classes, schoolId });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});
router.post("/print/complete", async (req, res) => {
    const cart = getPrintCart(req);

    await Student.updateMany(
        { _id: { $in: cart } },
        { $set: { status: "PRINTED" } }
    );

    req.session.printCart = []; // 🔥 clear cart
    res.redirect("/superAdmin");
});

router.get('/logout', function (req, res) {
    res.cookie('token', '', { expires: new Date(0) })
    return res.redirect('/')
})

module.exports = router