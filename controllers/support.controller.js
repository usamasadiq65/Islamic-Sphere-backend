const Support = require('../models/support.model');

// Create a new support ticket
exports.createSupport = async (req, res) => {
    try {
        const { firstName, lastName, email, subject, message } = req.body;
        
        const support = new Support({
            firstName,
            lastName: lastName || '',
            email,
            subject,
            message
        });

        await support.save();

        res.status(201).json({
            success: true,
            message: 'Support ticket created successfully',
            data: support
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating support ticket',
            error: error.message
        });
    }
};

// Delete a support ticket
// @route   DELETE /api/support/:id
// @access  Private/Admin
exports.deleteSupport = async (req, res) => {
    try {
        const support = await Support.findByIdAndDelete(req.params.id);
        
        if (!support) {
            return res.status(404).json({
                success: false,
                message: 'Support ticket not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Support ticket deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting support ticket',
            error: error.message
        });
    }
};

// Get all support tickets (for admin)
// @route   GET /api/support
// @access  Private/Admin
exports.getAllSupports = async (req, res) => {
    try {
        const supports = await Support.find().sort({ createdAt: -1 }); // Most recent first
        
        res.status(200).json({
            success: true,
            data: supports
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching support tickets',
            error: error.message
        });
    }
};

// Get support tickets by user email
exports.getUserSupports = async (req, res) => {
    try {
        const { email } = req.params;
        const supports = await Support.find({ email }).sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            data: supports
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user support tickets',
            error: error.message
        });
    }
};

// Update support ticket status (for admin)
exports.updateSupportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const support = await Support.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!support) {
            return res.status(404).json({
                success: false,
                message: 'Support ticket not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Support ticket status updated successfully',
            data: support
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating support ticket status',
            error: error.message
        });
    }
};
