var util = require('util');
var BinlogEvent = require('./binlog_event').BinlogEvent;
var Common = require('./common');

var Version2Events = [
  0x1e, // WRITE_ROWS_EVENT_V2,
  0x1f, // UPDATE_ROWS_EVENT_V2,
  0x20, // DELETE_ROWS_EVENT_V2
];

/**
 * Generic RowsEvent class
 * Attributes:
 *   position: Position inside next binlog
 *   binlogName: Name of next binlog file
 **/

function RowsEvent(parser, options) {
  BinlogEvent.apply(this, arguments);
  this._readTableId(parser);
  this.flags = parser.parseUnsignedNumber(2);

  // Version 2 Events
  if (Version2Events.indexOf(options.eventType) !== -1) {
    this.extraDataLength = parser.parseUnsignedNumber(2);
    // skip extra data
    parser.parseBuffer(this.extraDataLength - 2);
  }

  // Body
  this.numberOfColumns = parser.parseLengthCodedNumber();
}

util.inherits(RowsEvent, BinlogEvent);

RowsEvent.prototype.setTableMap = function(tableMap) {
  this.tableMap = tableMap;
};

function WriteRows(parser, options) {
  RowsEvent.apply(this, arguments);
  this.columnsPresentBitmap = parser.parseUnsignedNumber(
    Math.floor((this.numberOfColumns + 7) / 8));

  this.tableMap = options.tableMap;

  this.rows = [];
  while (!parser.reachedPacketEnd()) {
    this.rows.push(this._fetchOneRow(parser));
  }
}

util.inherits(WriteRows, RowsEvent);

WriteRows.prototype._fetchOneRow = function(parser) {
  var nullBitmap = parser.parseUnsignedNumber(
    Math.floor((this.numberOfColumns + 7) / 8));

  var row = {};
  var tableMap = this.tableMap[this.tableId];
  var columns = tableMap.columns;
  for (var i = 0; i < columns.length; i++) {
    var theColumn = columns[i];
    row[theColumn.name] = Common.readMysqlValue(parser, theColumn);
  }
  return row;
};

// return an array of column data
WriteRows.prototype.dump = function() {
  BinlogEvent.prototype.dump.apply(this);
  this.rows.forEach(function(row) {
    console.log('--');
    Object.keys(row).forEach(function(name) {
      console.log('column =>', name, 'value =>', row[name]);
    });
  });
};

exports.WriteRows = WriteRows;