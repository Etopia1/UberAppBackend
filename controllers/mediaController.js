const multler = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let folder = 'uberapp/others';
        let resource_type = 'auto';

        if (file.fieldname === 'profile') folder = 'uberapp/profile';
        else if (file.fieldname === 'video') {
            folder = 'uberapp/videos';
            resource_type = 'video';
        }
        else if (file.fieldname === 'audio') {
            folder = 'uberapp/audio';
            resource_type = 'video'; // Cloudinary treats audio as video resource_type often, or 'raw'
        }
        else if (file.fieldname === 'document') {
            folder = 'uberapp/documents';
            resource_type = 'raw';
        }
        else if (file.fieldname === 'image') folder = 'uberapp/images';

        return {
            folder: folder,
            resource_type: resource_type,
            public_id: `${file.fieldname}_${Date.now()}`, // Unique ID
        };
    },
});

const upload = multler({ storage: storage });

// Controllers
exports.uploadProfilePicture = (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({
        url: req.file.path, // Cloudinary URL
        filename: req.file.filename
    });
};

exports.uploadImage = (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({
        url: req.file.path,
        filename: req.file.filename
    });
};

exports.uploadVideo = (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({
        url: req.file.path,
        filename: req.file.filename
    });
};

exports.uploadAudio = (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({
        url: req.file.path,
        filename: req.file.filename
    });
};

exports.uploadDocument = (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({
        url: req.file.path,
        filename: req.file.filename,
        originalName: req.file.originalname
    });
};

exports.deleteMedia = async (req, res) => {
    const { filename, type } = req.body;
    // filename in Cloudinary is the public_id

    try {
        let resource_type = 'image';
        if (type === 'video' || type === 'audio') resource_type = 'video';
        else if (type === 'document') resource_type = 'raw';

        await cloudinary.uploader.destroy(filename, { resource_type: resource_type });
        res.json({ message: 'File deleted successfully from Cloudinary' });
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        res.status(500).json({ message: 'Failed to delete file' });
    }
};

module.exports.upload = upload;
