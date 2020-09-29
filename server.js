///////////////////////////////////////////////////////////////////////
// JSON & XML Web Data Connector																		 //
// A Tableau Web Data Connector for connecting to XML and JSON data. //
// Author: Keshia Rose                                               //
// GitHub: https://github.com/KeshiaRose/JSON-XML-WDC                //
// Version 1.1                                                       //
///////////////////////////////////////////////////////////////////////

const express = require('express');
const fetch = require('node-fetch');
const parseString = require('xml2js').parseString;
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.post('/xml', (req, res) => {
  let xml = req.body.xml;
  parseString(xml, function (err, result) {
    res.json(result);
  });
});

app.post('/proxy/*', (req, res) => {
  let url = req.url.split('/proxy/')[1];
  let options = {
    method: req.body.method,
  };

  if (req.body.token) {
    options['headers'] = {
      Authorization: `Bearer ${req.body.token}`,
    };
  }

  fetch(url, options)
    .then((response) => {
      if (response.ok) {
        response.text().then((body) => {
          res.send({ body });
        });
      } else {
        res.send({ error: response.statusText });
      }
    })
    .catch((error) => {
      res.send({ error: error.message });
    });
});

const listener = app.listen(PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
