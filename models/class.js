const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
classSchema.index({ className: 1 },{ unique: true });
module.exports = mongoose.model("Class", classSchema);