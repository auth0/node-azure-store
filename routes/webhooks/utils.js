var ejs = require('ejs'),
    path = require('path'),
    fs = require('fs');

var templates = {
  'create.xml': fs.readFileSync(path.join(__dirname, 'responses', 'create.xml'), 'utf8'),
  'get.xml': fs.readFileSync(path.join(__dirname, 'responses', 'get.xml'), 'utf8'),
  'sso.xml': fs.readFileSync(path.join(__dirname, 'responses', 'sso.xml'), 'utf8')
};

function loadTemplate (file, data) {
  return ejs.render(templates[file], data);
}

function slugify(text) {
  return text.replace(/[^\w]/g, '-').toLowerCase();
}

module.exports = {
  slugify: slugify,
  loadTemplate: loadTemplate
};
