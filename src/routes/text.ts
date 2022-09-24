import { Router } from 'express';
import { texts } from '../data';

const router = Router();
router.get('/:id', (req, res) => {
  try {
    const textId: number = +req.params.id;
    const text:string = texts[textId];
    if (!text) throw new Error("Not found");
    res.status(200).json(text)
  } catch (error) {
    if (error instanceof Error) res.status(404).json(error.message)
  }
});

export default router;
