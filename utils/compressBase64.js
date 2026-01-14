const sharp = require("sharp");

async function compressBase64Image(base64) {
  const buffer = Buffer.from(
    base64.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );

  return await sharp(buffer)
    .resize(300, 300)
    .jpeg({ quality: 70 })
    .toBuffer();
}

module.exports = compressBase64Image;