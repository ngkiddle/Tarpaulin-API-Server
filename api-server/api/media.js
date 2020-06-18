/*
 * API sub-router for assignments collection endpoints.
 */

const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');

const { validateAgainstSchema } = require('../lib/validation');

const { getSubmissionDownloadStreamByFilename } = require('../models/submission');

router.get('/submissions/:filename', (req, res, next) => {
  getSubmissionDownloadStreamByFilename(req.params.filename)
    .on('file', (file) => {
      res.status(200).type(file.metadata.contentType);
    })
    .on('error', (err) => {
      if (err.code === 'ENOENT') {
        next();
      } else {
        next(err);
      }
    })
    .pipe(res);
});

module.exports = router;
