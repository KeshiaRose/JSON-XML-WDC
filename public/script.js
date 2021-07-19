/* global tableau json2csv Papa xml2js */

///////////////////////////////////////////////////////////////////////
// JSON & XML Web Data Connector																		 //
// A Tableau Web Data Connector for connecting to XML and JSON data. //
// Author: Keshia Rose                                               //
// GitHub: https://github.com/KeshiaRose/JSON-XML-WDC                //
// Version 1.1                                                       //
///////////////////////////////////////////////////////////////////////

//////////////////////// Test data URLs //////////////////////////////
// https://json-xml-wdc.herokuapp.com/food.json                     //
// https://json-xml-wdc.herokuapp.com/orders.xml                    //
// https://api.covid19india.org/data.json                           //
// https://covidtracking.com/api/v1/states/daily.json               //
// https://clinicaltrials.gov/ct2/show/NCT03478891?displayxml=true  //
//////////////////////////////////////////////////////////////////////

let cachedTableData; // Always a JSON object

let myConnector = tableau.makeConnector();

// Create the schemas for each table
myConnector.getSchema = function(schemaCallback) {
  console.log("Creating table schemas.");
  let conData = JSON.parse(tableau.connectionData);
  let dataString = conData.dataString;
  let dataUrl = conData.dataUrl;
  let tables = conData.tables;
  let method = conData.method;
  let username = tableau.username || "";
  let token = tableau.password;
  let tableSchemas = [];

  _retrieveJsonData(
    { dataString, dataUrl, method, username, token },
    function(jsonData) {
      for (let table in tables) {
        let tableData = _jsToTable(jsonData, tables[table].fields);
        let headers = tableData.headers;
        let cols = [];
        let aliases = [];

        function findFriendlyName(f, tryNum) {
          let names = f.split(".");
          let alias = names
            .slice(names.length - tryNum, names.length)
            .join(" ")
            .replace(/_/g, " ");
          if (!aliases.includes(alias)) {
            aliases.push(alias);
            return alias;
          } else {
            return findFriendlyName(f, tryNum + 1);
          }
        }

        for (let field in headers) {
          cols.push({
            id: field.replace(/\$/g, "attr").replace(/[^A-Za-z0-9_]/g, "_"),
            alias: findFriendlyName(field, 1),
            dataType: headers[field]
          });
        }

        let tableSchema = {
          id: table,
          alias: tables[table].alias,
          columns: cols
        };
        tableSchemas.push(tableSchema);
        console.log("Table schema created: ", tableSchema);
      }

      schemaCallback(tableSchemas);
    }
  );
};

// Get the data for each table
myConnector.getData = function(table, doneCallback) {
  console.log("Getting data.");
  let conData = JSON.parse(tableau.connectionData);
  let dataString = conData.dataString;
  let dataUrl = conData.dataUrl;
  let tables = conData.tables;
  let method = conData.method;
  let username = tableau.username || "";
  let token = tableau.password;
  let tableSchemas = [];

  _retrieveJsonData({ dataString, dataUrl, method, username, token }, function(
    rawData
  ) {
    let currentTable = table.tableInfo.id;
    console.log("Getting data for table " + currentTable);

    let tableData = _jsToTable(rawData, tables[currentTable].fields);
    let newRows = [];
    for (let row of tableData.rows) {
      let newRow = {};
      for (let prop in row) {
        newRow[prop.replace(/\$/g, "attr").replace(/[^A-Za-z0-9_]/g, "_")] =
          row[prop];
      }
      newRows.push(newRow);
    }

    let row_index = 0;
    let size = 10000;
    while (row_index < newRows.length) {
      table.appendRows(newRows.slice(row_index, size + row_index));
      row_index += size;
      tableau.reportProgress("Getting row: " + row_index);
    }

    doneCallback();
  });
};

tableau.connectionName = "JSON/XML Data";
tableau.registerConnector(myConnector);
window._tableau.triggerInitialization &&
  window._tableau.triggerInitialization(); // Make sure WDC is initialized properly

// Gets data from URL or string. Inputs are all strings. Always returns JSON data, even if XML input.
async function _retrieveJsonData(
  { dataString, dataUrl, method, username, token },
  retrieveDataCallback
) {
  let rawData = dataString;

  if (!cachedTableData) {
    if (dataUrl) {
      let result = await $.post("/proxy/" + dataUrl, {
        method,
        username,
        token
      });
      if (result.error) {
        if (tableau.phase !== "interactive") {
          console.error(result.error);
          tableau.abortWithError(result.error);
        } else {
          _error(result.error);
        }
        return;
      }
      rawData =
        result.body.charCodeAt(0) === 65279
          ? result.body.slice(1)
          : result.body; // Remove BOM character if present
    }
  } else {
    retrieveDataCallback(cachedTableData);
    return;
  }
  const successCallback = function(data) {
    try {
      cachedTableData = JSON.parse(data);
    } catch (err) {
      _error("Error parsing JSON");
    }
    retrieveDataCallback(cachedTableData);
  };

  if (typeof rawData === "string" && rawData.trim().startsWith("<")) {
    xml2js.parseString(rawData, function(err, result) {
      successCallback(JSON.stringify(result));
      if (err) _error(err);
    });
    return;
  }
  successCallback(rawData);
}

// Turns tabular data into json for Tableau input
function _csv2table(csv) {
  let lines = Papa.parse(csv, {
    delimiter: ",",
    newline: "\n",
    dynamicTyping: true
  }).data;
  let fields = lines.shift();
  let headers = {};
  let rows = [];

  for (let field of fields) headers[field] = {};

  for (let line of lines) {
    var obj = {};
    for (let field in fields) {
      let header = headers[fields[field]];
      let value = line[field];

      if (
        value === "" ||
        value === '""' ||
        value === "null" ||
        value === null
      ) {
        obj[fields[field]] = null;
        header.null = header.null ? header.null + 1 : 1;
      } else if (value === "true" || value === true) {
        obj[fields[field]] = true;
        header.bool = header.bool ? header.bool + 1 : 1;
      } else if (value === "false" || value === false) {
        obj[fields[field]] = false;
        header.bool = header.bool ? header.bool + 1 : 1;
      } else if (typeof value === "object") {
        obj[fields[field]] = value.toISOString();
        header.string = header.string ? header.string + 1 : 1;
      } else if (!isNaN(value)) {
        obj[fields[field]] = value;
        if (parseInt(value) == value) {
          header.int = header.int ? header.int + 1 : 1;
        } else {
          header.float = header.float ? header.float + 1 : 1;
        }
      } else {
        obj[fields[field]] = value;
        header.string = header.string ? header.string + 1 : 1;
      }
    }
    rows.push(obj);
  }

  for (let field in headers) {
    // strings
    if (headers[field].string) {
      headers[field] = "string";
      continue;
    }
    // nulls
    if (Object.keys(headers[field]).length === 1 && headers[field].null) {
      headers[field] = "string";
      continue;
    }
    // floats
    if (headers[field].float) {
      headers[field] = "float";
      continue;
    }
    // integers
    if (headers[field].int) {
      headers[field] = "int";
      continue;
    }
    // booleans
    if (headers[field].bool) {
      headers[field] = "bool";
      continue;
    }
    headers[field] = "string";
  }

  return { headers, rows };
}

// Flattens out the JSON data to a  tabular format
function _jsToTable(data, fields) {
  let paths = new Set();
  for (let field of fields) {
    let levels = field.split(".");
    for (let level in levels) {
      paths.add(levels.slice(0, +level + 1).join("."));
    }
  }
  paths = Array.from(paths);
  const json2csvParser = new json2csv.Parser({
    fields,
    transforms: [json2csv.transforms.unwind({ paths })]
  });
  const csvData = json2csvParser.parse(data);
  return _csv2table(csvData);
}

// Grabs all the possible paths for properties in an object
function _objectToPaths(data) {
  let result = new Set();
  getPath(data, "");
  let paths = Array.from(result);
  return paths;

  function getPath(data, path) {
    if (data && typeof data === "object") {
      if (Array.isArray(data)) {
        for (let i in data) {
          getPath(data[i], path);
        }
      } else {
        for (let p in data) {
          getPath(data[p], path + p + ".");
        }
      }
    } else {
      path = path.split("");
      path.pop();
      result.add(path.join(""));
    }
  }
}

// Turns an array of object path names into an object for display
function _pathsToTree(paths) {
  let result = {};
  function makeTree(path, level) {
    let levels = path.split(".");
    let currentLevel = levels.slice(level, level + 1);

    if (level === 0) {
      if (!result[currentLevel]) result[currentLevel] = {};
    } else {
      let cur = result[levels[0]];
      for (let c of levels.slice(1, level + 1)) {
        if (cur[c]) {
          cur = cur[c];
        } else {
          cur[c] = {};
        }
      }
    }
    if (level + 1 < levels.length) {
      makeTree(path, level + 1);
    }
  }
  for (let path of paths) {
    makeTree(path, 0);
  }
  return result;
}

function _addTable() {
  let tableID = 0; // Scan highest table id number then +1
  $("input[data-tableid]").each(function() {
    tableID =
      $(this).data("tableid") > tableID ? $(this).data("tableid") : tableID;
  });
  tableID++;

  let tableTemplate = `
    <div class="table" data-tableid="${tableID}">
      <p class="label">Table Name</p>
      <div class="row">
        <input data-tableid="${tableID}" type="text" placeholder="My Data (${tableID +
    1})"/>
        <button class="delete" data-tableid="${tableID}" onclick="_deleteTable(this)">Delete</button>
      </div>
      <div class="selections">
        <span><a onclick="_selectAll(this)" data-tableid="${tableID}">Select All</a></span>
        <span><a onclick="_clearAll(this)" data-tableid="${tableID}">Clear All</a></span>
      </div>
      <div class="fields" data-tableid="${tableID}">No data fields found</div>
    </div>
  `;

  $("#tables").append(tableTemplate);
  _askForFields(tableID);
}

function _deleteTable(e) {
  let tableID = $(e).data("tableid");
  let table = $(".table[data-tableid=" + tableID + "]");
  table.remove();
}

// Switches to field input form and displays potential fields
async function _askForFields(tableID) {
  let conData = JSON.parse(tableau.connectionData);
  let dataString = conData.dataString;
  let dataUrl = conData.dataUrl;
  let method = conData.method;
  let username = tableau.username || "";
  let token = tableau.password;

  let div = $(".fields[data-tableid=" + tableID + "]");
  let fieldsTree;

  await _retrieveJsonData({ dataString, dataUrl, method, username, token }, function(
    rawData
  ) {
    fieldsTree = _pathsToTree(_objectToPaths(rawData));
  });

  if (!fieldsTree) return;

  let output = "";

  function displayFields(fields, spacing, parent) {
    for (let field in fields) {
      let showCheck = Object.keys(fields[field]).length === 0;
      output += `<div class='field' onclick='${
        showCheck ? "_toggleCheck(this)" : "_toggleChildCheck(this)"
      }' data-checked='false' style="padding-left:${spacing}px;" data-tableid='${tableID}' data-visible='${showCheck}' data-field='${(parent ===
      ""
        ? ""
        : parent + ".") + field}'>
        ${
          showCheck
            ? '<div class="check"></div>'
            : '<div class="check nested"></div>'
        }
        <div class="fieldText" >
          ${field}
        </div>
      </div>`;
      if (fields[field]) {
        displayFields(
          fields[field],
          spacing + 10,
          (parent === "" ? "" : parent + ".") + field
        );
      }
    }
  }

  displayFields(fieldsTree, 0, "");

  div.html(output);
  $("#dataInput").css("display", "none");
  $("#fieldInput").css("display", "block");
}

// Checks if JSON is parseable
function _checkJSONFormat(input) {
  input = input.trim();
  if (!input.startsWith("<")) {
    let dataJSON;
    try {
      dataJSON = JSON.parse(input);
    } catch (e) {
      dataJSON = JSON.parse(JSON.stringify(eval("(" + input + ")")));
    }
    return JSON.stringify(dataJSON);
  }
  return input;
}

// Grabs wanted fields and submits data to Tableau
function _submitDataToTableau() {
  let tables = {};

  // Make sure no duplicate table names
  $(".table").each(function() {
    let tableName = (
      $(this)
        .find("input[data-tableid]")
        .val() || "My Data"
    ).trim();
    let tableID = $(this)
      .find("input[data-tableid]")
      .data("tableid");
    let tableTableauID = tableName.replace(/[^A-Za-z0-9_]/g, "_");
    function createUniqueID(tableTableauID, tryNum) {
      let tryText = tryNum ? "_" + (tryNum + 1) : "";
      tables.hasOwnProperty(tableTableauID + tryText)
        ? createUniqueID(tableTableauID, tryNum + 1)
        : (tables[tableTableauID + tryText] = {
            id: tableID,
            alias: tableName + tryText
          });
    }
    createUniqueID(tableTableauID, null);
  });

  for (let table in tables) {
    let fields = [];
    $(".field[data-tableid=" + tables[table].id + "]").each(function() {
      if ($(this).data("visible") && $(this).data("checked") === "true") {
        fields.push($(this).data("field"));
      }
    });
    tables[table]["fields"] = fields;
  }

  let fieldCount = 0;
  for (let table in tables) {
    tables[table].fields.length === 0 ? delete tables[table] : fieldCount++;
  }

  if (fieldCount > 0) {
    let conData = JSON.parse(tableau.connectionData);
    conData = { ...conData, tables };
    tableau.connectionData = JSON.stringify(conData);
    tableau.submit();
  } else {
    _error("No fields selected.");
  }
}

function toggleAdvanced() {
  $("#advanced").toggleClass("hidden");
}

// Toggles checkedness of field
function _toggleCheck(e) {
  let checked = $(e).data("checked") === "true";
  $(e).data("checked", checked ? "false" : "true");
  $(e)
    .find(".check")
    .toggleClass("checked");
}

// Toggles checkedness for all fields under a parent
function _toggleChildCheck(e) {
  let parentTableID = $(e).data("tableid");
  let parentField = $(e).data("field");
  let children = $("#tables").find(
    `[data-tableID='${parentTableID}'][data-field^='${parentField}'][data-field!='${parentField}']`
  );
  let childCount = children.length;
  let checkedCount = children.filter(function(i) {
    return $(this).data("checked") === "true";
  }).length;

  children.each(function() {
    if (childCount === checkedCount) {
      $(this).data("checked", "false");
      $(this)
        .find(".check")
        .removeClass("checked");
    } else {
      $(this).data("checked", "true");
      $(this)
        .find(".check")
        .addClass("checked");
    }
  });
}

// Selects all fields
function _selectAll(e) {
  let tableID = $(e).data("tableid");
  $(".field[data-tableid=" + tableID + "]").each(function() {
    $(this).data("checked", "true");
    $(this)
      .find(".check")
      .addClass("checked");
  });
}

// Clears all checked fields
function _clearAll(e) {
  let tableID = $(e).data("tableid");
  $(".field[data-tableid=" + tableID + "]").each(function() {
    $(this).data("checked", "false");
    $(this)
      .find(".check")
      .removeClass("checked");
  });
}

// Takes data, does basic vaildation and goes to field selection phase
function _next(dataString) {
  dataString = (dataString || $("#paste").val()).trim();
  let dataUrl = $("#url")
    .val()
    .trim();
  let method = $("#method").val();
  let token = $("#token").val();
  let username = $("#username").val();
  let password = $("#password").val();
  if (!dataString && !dataUrl) return _error("No data entered.");

  if (dataString) {
    if (!dataString.startsWith("<")) {
      try {
        JSON.parse(_checkJSONFormat(dataString));
      } catch (e) {
        return _error("Data entered is not valid JSON.");
      }
    }

    if (dataString.startsWith("<")) {
      try {
        let xmlDoc = $.parseXML(dataString);
      } catch (err) {
        return _error("Data entered is not valid XML.");
      }
    }
  }

  if (dataUrl) {
    const urlRegex = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i;
    const result = dataUrl.match(urlRegex);
    if (result === null) return _error("URL is not valid.");
  }

  if (dataString) dataString = _checkJSONFormat(dataString);
  tableau.connectionData = JSON.stringify({ dataString, dataUrl, method });
  tableau.username = username;
  tableau.password = token || password;

  _askForFields(0);
}

// Shows error message below submit button
function _error(message) {
  $(".error")
    .fadeIn("fast")
    .delay(3000)
    .fadeOut("slow");
  $(".error").html(message);
  $("html, body").animate({ scrollTop: $(document).height() }, "fast");
}

// All of the below handles draging and dropping files
function cancel(e) {
  e.stopPropagation();
  e.preventDefault();
}

$(document)
  .on("dragenter", cancel)
  .on("drop", cancel)
  .on("dragover", function(e) {
    cancel(e);
    $("#dragdrop").css("border", "2px dashed #FE6568");
  })
  .on("dragleave", function(e) {
    cancel(e);
    $("#dragdrop").css("border", "2px dashed #CCC");
  });

$("#dragdrop")
  .on("dragenter", cancel)
  .on("dragover", function(e) {
    cancel(e);
    $(this).css("border", "2px solid #FE6568");
    $(this).css("background-color", "#FFCECF");
  })
  .on("dragleave", function(e) {
    cancel(e);
    $(this).css("border", "2px dashed #CCC");
    $(this).css("background-color", "#FFFFFF");
  })
  .on("drop", function(e) {
    cancel(e);
    $(this).css("border", "2px dashed #CCC");
    $(this).css("background-color", "#FFFFFF");
    try {
      let files = e.originalEvent.dataTransfer.files;
      let file = files[0];
      let reader = new FileReader();
      reader.onload = function(e) {
        _next(reader.result);
      };
      reader.readAsText(file);
    } catch (err) {
      _error("Could not read file.");
      console.log(err);
    }
  });
