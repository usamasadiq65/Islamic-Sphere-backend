const Dua = require('../models/dua.model');

// Retrieve one random Quranic dua and one random Hadees dua
const getRandomDua = async (req, res) => {
  const { emotion, noOfQuranicDua, noOfHadeesDua } = req.query;

  try {
    const quranicDua = await Dua.aggregate([
      { $match: { type: 'quranic', emotion: emotion } },
      { $sample: { size: parseInt(noOfQuranicDua) } },
    ]);

    const hadeesDua = await Dua.aggregate([
      { $match: { type: 'hadees', emotion: emotion } },
      { $sample: { size: parseInt(noOfHadeesDua) } },
    ]);

    return res.status(200).json({ message: 'Dua fetched successfully', data: { quranicDua: quranicDua, hadeesDua: hadeesDua }, error: null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', data: null, error: err.message });
  }
};

// Add new dua
const addDua = async (req, res) => {
  try {
    const { emotion, type, reference, arabic, urduTranslation } = req.body;

    // Validate required fields
    if (!emotion || !type || !reference || !arabic || !urduTranslation) {
      return res.status(400).json({
        message: 'Missing required fields',
        data: null,
        error: 'All fields are required'
      });
    }

    // Validate type enum
    if (!['quranic', 'hadees'].includes(type)) {
      return res.status(400).json({
        message: 'Invalid type',
        data: null,
        error: 'Type must be either quranic or hadees'
      });
    }

    const newDua = new Dua({
      emotion,
      type,
      reference,
      arabic,
      urduTranslation
    });

    const savedDua = await newDua.save();
    return res.status(201).json({
      message: 'Dua added successfully',
      data: savedDua,
      error: null
    });
  } catch (err) {
    console.error('Error adding dua:', err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
};

// Update existing dua
const updateDua = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedDua = await Dua.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedDua) {
      return res.status(404).json({
        message: 'Dua not found',
        data: null,
        error: 'Dua not found'
      });
    }

    return res.status(200).json({
      message: 'Dua updated successfully',
      data: updatedDua,
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
};

// Delete dua
const deleteDua = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedDua = await Dua.findByIdAndDelete(id);

    if (!deletedDua) {
      return res.status(404).json({
        message: 'Dua not found',
        data: null,
        error: 'Dua not found'
      });
    }

    return res.status(200).json({
      message: 'Dua deleted successfully',
      data: null,
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
};

// Get all duas
const getAllDuas = async (req, res) => {
  try {
    const duas = await Dua.find();
    return res.status(200).json({
      message: 'Duas fetched successfully',
      data: duas,
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
};

module.exports = {
  getRandomDua,
  addDua,
  updateDua,
  deleteDua,
  getAllDuas
};
