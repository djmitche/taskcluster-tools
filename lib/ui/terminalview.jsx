var React           = require('react');
var utils           = require('../utils');
var ansi_up         = require('ansi_up');
var CodeMirror      = require('react-code-mirror');


/** Display terminal output */

/* This is optimized to very quickly show the tail of very long logs with
 * minimal browser jank.  To accomplish this, it adds at most one 100-line
 * <pre> element to the div at a time, allowing the browser to re-paint in
 * between.  The browser is smart enough to figure out that no repaint is
 * necessary for any new <pre> that is not visible.
 */

var CHUNK_SIZE = 10;
var LINE_HEIGHT = 13;

var dbg = function() {
    console.log.apply(console, arguments);
    console.timeStamp.apply(console, arguments);
};

var TerminalView = React.createClass({
  mixins: [
    // Call this.open() when props.url changes
    utils.createWatchStateMixin({
      onProps: {
        open:                     ['url']
      }
    })
  ],

  getDefaultProps: function() {
    return {
      url:            undefined,  // No URL to display at this point
    };
  },

  getInitialState: function() {
    return {
      data: '',
    };
  },

  propTypes: {
    url:      React.PropTypes.string,
  },

  // Refresh the currently displayed file
  refresh: function() {
    this.open();
  },

  /** Open a URL in the terminal */
  open: function() {
    // Abort previous request if any
    if (this.request) {
      this.abortRequest();
    }

    this.setState({
      data: '',
    });

/*
    this.nextLine = 0;      // index of the next line
    this.chunks = [];       // info about each <pre> element
    this.buffer = '';       // un-terminated trailing data
*/
    this.dataOffset = 0;    // offset of the next byte to be received

    // If not given a URL we'll just stop here with an empty terminal
    if (!this.props.url) {
      return;
    }

    // Open a new request
    dbg("req");
    this.request = new XMLHttpRequest();
    this.request.open('get', this.props.url, true);
    this.request.addEventListener('progress', this.onData);
    this.request.addEventListener('load', this.onData);
    this.request.send();
  },

  writeData: function(data) {
    dbg("write", data);
    this.setState({
      data: data
    });
/*
    var lines = (this.buffer + data).split("\n");
    this.buffer = lines.pop();  // empty unless data was not newline-terminated

    // chunk those lines
    var offset = this.nextLine;
    var cur_chunk = this.chunks[this.chunks.length-1];
    if (cur_chunk) {
        cur_chunk.drawn = false;
    }
    lines.forEach(function (l, i) {
        i += offset;
        if (i % CHUNK_SIZE == 0) {
            dbg("new chunk", this.chunks.length);
            cur_chunk = {
                drawn: false,
                lines: [l],
                element: <pre key={this.chunks.length}></pre>
            };
            this.chunks.push(cur_chunk);
        } else {
            cur_chunk.lines.push(l)
        }
    }.bind(this));
    this.nextLine += lines.length;

    dbg("update state");
    this.setState({
      elements: this.chunks.map(function(c) { return c.element }),
    });
    dbg("update state complete");
    */
  },

  onData: function() {
    dbg("onData");
    // Write data to term if there is any data
    if (this.request.responseText !== null ||
        this.request.responseText !== undefined) {
      // Check if we have new data
      var length = this.request.responseText.length;
      dbg("x");
      if (length > this.dataOffset) {
        // Find new data
        var data = this.request.responseText.slice(this.dataOffset, length);
        // Update dataOffset
        this.dataOffset = length;
        // Write to term
      dbg("xy");
        this.writeData(data);
      }
    }
    // When request is done
    if (this.request.readyState === this.request.DONE) {
      dbg("xz");
      // add a trailing newline if none was provided
      if (this.buffer) {
        this.writeData("\n");
      }
      // Write an error, if request failed
      if (this.request.status !== 200) {
        this.writeData("\r\n[task-inspector] Failed to fetch log!\r\n");
      }
      dbg("done");
    }
  },

  abortRequest: function() {
    this.request.removeEventListener('progress', this.onData);
    this.request.removeEventListener('load', this.onData);
    this.request.abort();
    this.request = null;
  },

  componentWillUnmount: function() {
    if (this.request) {
      this.abortRequest();
    }
  },

  render: function() {
      return <div>
      <span>Data: {this.state.data}</span>
      <CodeMirror
        ref="editor"
        mode="text"
        readOnly={true}
        value={this.state.data}
        theme="ambiance"/>
      </div>
  }
});

// Export TerminalView
module.exports = TerminalView;
