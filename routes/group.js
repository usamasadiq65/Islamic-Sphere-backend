const express = require('express');
const router = express.Router();
const authorize = require('../middlewares/authorization');
// const isAdmin = require('../middlewares/isAdmin');
const {
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroupDetails,
  deleteGroup,
  groupActions,
  addTask,
  deleteTask,
  taskActions,
  addPoll,
  deletePoll,
  pollActions,
  toggleProgressVisibility,
  getAllGroups,
  updateGroupByAdmin,
  deleteGroupByAdmin,
  // User Task List functions
  getUserTaskList,
  addToUserTaskList,
  removeFromUserTaskList,
  // Progress History functions
  getUserProgressHistory,
  getProgressSummary,
  // Ownership management functions
  addOwner,
  removeOwner
} = require('../controllers/group.controller');

// Make sure all group routes are protected
router.use(authorize);

// User Task List routes (must be before :groupId routes to avoid conflicts)
router.get('/user-task-list', getUserTaskList);
router.post('/user-task-list', addToUserTaskList);
router.delete('/user-task-list/:taskId', removeFromUserTaskList);

// Progress History routes
router.get('/progress/history', getUserProgressHistory);
router.get('/progress/summary', getProgressSummary);

router.post('/create', createGroup);
router.get('/user-groups', getUserGroups);
router.get('/:groupId', getGroupDetails);
router.put('/:groupId', updateGroupDetails);
router.delete('/:groupId', deleteGroup);
router.post('/:groupId/actions', groupActions);

// Ownership management routes
router.post('/:groupId/owners', addOwner);
router.delete('/:groupId/owners', removeOwner);

router.post('/:groupId/tasks', addTask);
router.delete('/:groupId/tasks/:taskId', deleteTask);
router.post('/:groupId/tasks/:taskId/actions', taskActions);

router.post('/:groupId/polls', authorize, addPoll);
router.delete('/:groupId/polls/:pollId', authorize, deletePoll);
router.post('/:groupId/polls/:pollId/vote', authorize, pollActions);

router.post('/:groupId/toggleProgress', authorize, toggleProgressVisibility);

// Admin routes
// router.get('/admin/groups', [authorize, isAdmin], getAllGroups);
// router.put('/admin/groups/:groupId', [authorize, isAdmin], updateGroupByAdmin);
// router.delete('/admin/groups/:groupId', [authorize, isAdmin], deleteGroupByAdmin);

router.get('/admin/groups', authorize, getAllGroups);
router.put('/admin/groups/:groupId', authorize, updateGroupByAdmin);
router.delete('/admin/groups/:groupId', authorize, deleteGroupByAdmin);

module.exports = router;
