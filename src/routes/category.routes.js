import express from 'express';
const router = express.Router();
import * as categoryCtrl from '../controllers/category.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

router.use(authenticate);

router.post('/', categoryCtrl.createCategory);

router.get('/', categoryCtrl.getCategories);

router.get('/:id', categoryCtrl.getCategoryById);

router.put('/:id', categoryCtrl.updateCategory);

router.delete('/:id', categoryCtrl.deleteCategory);

export default router;
