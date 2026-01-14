const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },

    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      default: null
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    dob: {
      type: Date,
      required: true
    },

    fatherName: {
      type: String,
      required: true,
      trim: true
    },

    motherName: {
      type: String,
      trim: true
    },

    admissionNo: {
      type: String,
      trim: true
    },

    address: {
      type: String,
      required: true
    },

    contactNumber: {
      type: String,
      required: true
    },

    image: {
      type: String // Cloudinary URL
    },
    status: {
      type: String,
      enum: ["PENDING", "SUBMITTED", "PRINTED"],
      default: "PENDING",
      index: true,
    }
  },
  { timestamps: true }
);

// ✅ Unique admission per school (industry practice)
studentSchema.index(
  { schoolId: 1, admissionNo: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("Student", studentSchema);