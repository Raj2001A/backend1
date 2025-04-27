import express from 'express';
import multer from 'multer';
import { importEmployees, getImportTemplate } from '../controllers/importController';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (
      file.mimetype === 'application/vnd.ms-excel' || 
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only Excel files are allowed'));
    }
  }
});

// Route to import employees from Excel file
router.post('/employees', upload.single('file'), importEmployees);

// Route to get import template
router.get('/template', getImportTemplate);

export default router;
