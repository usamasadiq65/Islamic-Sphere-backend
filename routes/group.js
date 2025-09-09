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
  deleteGroupByAdmin
} = require('../controllers/group.controller');

// Make sure all group routes are protected
router.use(authorize);

router.post('/create', createGroup);
router.get('/user-groups', getUserGroups);
router.get('/:groupId', getGroupDetails);
router.put('/:groupId', updateGroupDetails);
router.delete('/:groupId', deleteGroup);
router.post('/:groupId/actions', groupActions);

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
