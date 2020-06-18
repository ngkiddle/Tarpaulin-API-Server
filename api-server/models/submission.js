/*
 * Submission schema and data accessor methods.
 */

const { ObjectId, GridFSBucket } = require('mongodb');
const fs = require('fs');

const { getDBReference } = require('../lib/mongo');
const { extractValidFields } = require('../lib/validation');

/*
 * Schema describing required/optional fields of a submission object.
 */
const SubmissionSchema = {
  assignmentId: { required: true },
  studentId: { required: true }
};
exports.SubmissionSchema = SubmissionSchema;

exports.saveSubmissionFile = async function (submission) {
  return new Promise((resolve, reject) => {
    const db = getDBReference();
    const bucket = new GridFSBucket(db, {
      bucketName: 'submissions'
    });
    const time = new Date();
    let metadata = {
      contentType: submission.contentType,
      assignmentId: submission.assignmentId,
      studentId: submission.studentId,
      timestamp: time.toISOString()
    };

    const uploadStream = bucket.openUploadStream(
      submission.filename,
      { metadata: metadata }
    );
    fs.createReadStream(submission.path).pipe(uploadStream)
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', (result) => {
        resolve(result._id);
      });
  });
};

exports.getSubmissionsPageByAssignmentId = async function (assignmentId, page) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, {
    bucketName: 'submissions'
  });

  /*
   * Compute last page number and make sure page is within allowed bounds.
   * Compute offset into collection.
   */
  const all = await bucket.find({ "metadata.assignmentId": assignmentId }).toArray();
  const count = all.length;
  console.log(`== Submissions count: ${count}`);
  const pageSize = 10;
  const lastPage = Math.ceil(count / pageSize);
  page = page > lastPage ? lastPage : page;
  page = page < 1 ? 1 : page;
  const offset = (page - 1) * pageSize;

  const results = await bucket.find({ "metadata.assignmentId": assignmentId })
    .sort({ _id: 1 })
    .skip(offset)
    .limit(pageSize)
    .toArray();
  
  let response = [];
  results.forEach(function(submission) {
    const responseBody = {
      _id: submission._id,
      url: `/media/submissions/${submission.filename}`,
      contentType: submission.metadata.contentType,
      assignmentId: submission.metadata.assignmentId,
      studentId: submission.metadata.studentId,
      timestamp: submission.metadata.timestamp
    };
    response.push(responseBody);
  });
  return {
    submissions: response,
    page: page,
    totalPages: lastPage,
    pageSize: pageSize,
    count: count
  };
};

exports.getSubmissionDownloadStreamByFilename = function (filename) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, {
    bucketName: 'submissions'
  });
  return bucket.openDownloadStreamByName(filename);
};