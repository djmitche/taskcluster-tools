var React           = require('react');
var utils           = require('../utils');
var ansi_up         = require('ansi_up');
var Infinite        = require('react-infinite');


/** Display terminal output */
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
      elements:          [],
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
    this.setState({
        elements: [],
    });
    this.buffer = '';  // un-terminated trailing data

    // Abort previous request if any
    if (this.request) {
      this.abortRequest();
    }

    // If not given a URL we'll just stop here with an empty terminal
    if (!this.props.url) {
      return;
    }

    // Open a new request
    console.timeStamp("req");
    this.dataOffset = 0;
    this.request = new XMLHttpRequest();
    this.request.open('get', this.props.url, true);
    this.request.addEventListener('progress', this.onData);
    this.request.addEventListener('load', this.onData);
    this.request.send();
  },

  writeData: function(data) {
    console.timeStamp("write");
    var lines = (this.buffer + data).split("\n");
    this.buffer = lines.pop();  // empty unless data was not newline-terminated

    var newElements = [];
    var offset = this.state.elements.length;
    lines.forEach(function(l, i) {
      newElements.push(<p key={offset+i}>{l}</p>);
    });
    this.setState({
      elements: this.state.elements.concat(newElements)
    });
  },

  onData: function() {
    console.timeStamp("onData");
    // Write data to term if there is any data
    if (this.request.responseText !== null ||
        this.request.responseText !== undefined) {
      // Check if we have new data
      var length = this.request.responseText.length;
      if (length > this.dataOffset) {
        // Find new data
        var data = this.request.responseText.slice(this.dataOffset, length);
        // Update dataOffset
        this.dataOffset = length;
        // Write to term
        this.writeData(data);
      }
    }
    // When request is done
    if (this.request.readyState === this.request.DONE) {
      // add a trailing newline if none was provided
      if (this.buffer) {
        this.writeData("\n");
      }
      // Write an error, if request failed
      if (this.request.status !== 200) {
        this.writeData("\r\n[task-inspector] Failed to fetch log!\r\n");
      }
      console.timeStamp("done");
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
    console.timeStamp("RENDER");
    return <Infinite
        containerHeight={840}
        elementHeight={13}
        className="terminal-view">
        {this.state.elements}
    </Infinite>
  }
});

// Export TerminalView
module.exports = TerminalView;
