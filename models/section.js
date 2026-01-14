const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    sectionName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);
sectionSchema.index(
  { classId: 1, sectionName: 1 },
  { unique: true }
);
module.exports = mongoose.model("Section", sectionSchema);