const { string } = require("joi");
const mongoose = require("mongoose");

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    address: String,
    pincode:String,
    state:String,

    logo: String, // Cloudinary URL

    principalSignature: String, // Cloudinary URL

    selectedTemplate: {
      type: String,
      default: "template1",
    },

    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("School", schoolSchema);