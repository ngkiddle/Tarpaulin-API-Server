const express = require('express');
const morgan = require('morgan');

const api = require('./api');
const { connectToDB } = require('./lib/mongo');
const { applyRateLimit } = require('./lib/redis');
const { getCSVDownloadStreamByFilename } = require('./models/course');

const app = express();
const port = process.env.PORT || 8000;

/*
 * Morgan is a popular logger.
 */
app.use(morgan('dev'));
app.use(applyRateLimit);
app.use(express.json());
app.use(express.static('public'));

/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */
app.use('/', api);

app.get('/media/roster/:filename', (req, res, next) => {
  getCSVDownloadStreamByFilename(req.params.filename)
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

app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  });
});

  connectToDB(async () => {
    try {
      // await connectToRabbitMQ('images');
      app.listen(port, () => {
        console.log("== Server is running on port", port);
      });
    } catch (err) {
      console.log("== error: ", err);
    }
  });

