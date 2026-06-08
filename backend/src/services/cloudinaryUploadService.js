const path = require("path");
const cloudinary = require("../config/cloudinary");
const env = require("../config/env");

class CloudinaryStorageError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "CloudinaryStorageError";
    this.statusCode = statusCode;
  }
}

function assertCloudinaryConfigured() {
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret
  ) {
    throw new CloudinaryStorageError(
      "Cloud PDF storage is not configured. Please add Cloudinary credentials.",
      500
    );
  }
}

function getSafePublicId(originalFilename) {
  const parsedName = path.parse(originalFilename || "paper").name;
  const safeName = parsedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `paperlens/${Date.now()}-${safeName || "paper"}`;
}

function uploadPdf(file) {
  assertCloudinaryConfigured();

  if (!file?.buffer) {
    throw new CloudinaryStorageError("No PDF file was provided.", 400);
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: getSafePublicId(file.originalname),
        resource_type: "raw",
        overwrite: false,
        use_filename: false
      },
      (error, result) => {
        if (error) {
          return reject(
            new CloudinaryStorageError(
              "Unable to upload the PDF to cloud storage. Please try again."
            )
          );
        }

        return resolve({
          cloudinaryPublicId: result.public_id,
          fileUrl: result.secure_url,
          secureUrl: result.secure_url,
          originalFilename: file.originalname,
          fileSize: file.size,
          uploadDate: new Date()
        });
      }
    );

    uploadStream.end(file.buffer);
  });
}

async function deletePdf(publicId) {
  assertCloudinaryConfigured();

  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
      invalidate: true
    });
  } catch (error) {
    throw new CloudinaryStorageError(
      "Unable to delete the PDF from cloud storage. Please try again."
    );
  }
}

module.exports = {
  CloudinaryStorageError,
  deletePdf,
  uploadPdf
};
