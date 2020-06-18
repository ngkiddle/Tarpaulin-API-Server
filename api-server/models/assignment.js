/*
 * Assignment schema and data accessor methods.
 */
const { ObjectId } = require('mongodb');
const { getDBReference } = require('../lib/mongo');
const { extractValidFields } = require('../lib/validation');

/*
 * Schema describing required/optional fields of a review object.
 */
const AssignmentSchema = {
  courseId: { required: true },
  title: { required: true },
  points: { required: true },
  due: { required: true },
};
exports.AssignmentSchema = AssignmentSchema;

async function getAssignmentCountByCourseId(id) {
  const db = getDBReference();
  const collection = db.collection('assignments');
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    const results = await collection
      .find({ courseId: id })
      .toArray();
    return results.length;
  }
}
exports.getAssignmentCountByCourseId = getAssignmentCountByCourseId;

/*
 * Executes a DB query to insert a new assignment into the database.  Returns
 * a Promise that resolves to the ID of the newly-created assignment entry.
 */
async function insertNewAssignment(assignment) {
  assignment = extractValidFields(assignment, AssignmentSchema);
  const db = getDBReference();
  const collection = db.collection('assignments');
  const result = await collection.insertOne(assignment);
  return result.insertedId;
}
exports.insertNewAssignment = insertNewAssignment;


async function getAssignmentById(id) {
  const db = getDBReference();
  const collection = db.collection('assignments');
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    const results = await collection
      .find({ _id: new ObjectId(id) })
      .toArray();
    return results[0];
  }
}
exports.getAssignmentById = getAssignmentById;


async function deleteAssignmentById(id) {
  const db = getDBReference();
  const collection = db.collection('assignments');
  const result = await collection.deleteOne({
    _id: new ObjectId(id)
  });
  return result.deletedCount > 0;
}
exports.deleteAssignmentById = deleteAssignmentById;


async function updateAssignmentById(id, assignment) {
  assignmentValues = extractValidFields(assignment, AssignmentSchema);
  const db = getDBReference();
  const collection = db.collection('assignments');
  console.log(`== Looking for assignment with ID : ${id}`);
  const result = await collection.updateOne(
    { _id: new ObjectId(id) },
    {$set: assignmentValues}
  );
  return result.matchedCount > 0;
}
exports.updateAssignmentById = updateAssignmentById;
