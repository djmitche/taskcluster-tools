var React            = require('react');
var bs               = require('react-bootstrap');
var utils            = require('../lib/utils');
var taskcluster      = require('taskcluster-client');

// temporary until we have an updated taskcluster-client with the new methods in it
var reference        = require('./temp-aws-prov-reference');

var AmiSetManager = React.createClass({
  /** Initialize mixins */
  mixins: [
    utils.createTaskClusterMixin({
      clients: {
        awsProvisioner:       taskcluster.createClient(reference);
      },
      clientOpts: {
        awsProvisioner: {
          baseUrl:      'https://aws-provisioner.taskcluster.net/v1'
        }
      },
    }),
    // Serialize state.selectedAmiSet to location.hash as string
    utils.createLocationHashMixin({
      keys:                   ['selectedAmiSet'],
      type:                   'string'
    })
  ],

  /** Create an initial state */
  getInitialState() {
    return {
      amiSetsLoaded:      false,
      amiSetsError:       undefined,
      amiSets:            undefined,
      selectedAmiSet:   ''   // '' means "add new ami-set"
    };
  },

  /** Load state from amiSet (using TaskClusterMixin) */
  load() {
    // Creates state properties:
    // - AmiSetsLoaded
    // - AmiSetsError
    // - AmiSets
    return {
      amiSets: this.awsProvisioner.listAmiSets()
    };
  },

  /** Render user-interface */
  render() {
    return (
      <span>
      <bs.Row>
        <bs.Col md={5}>
          {this.renderAmiSetsTable()}
          <bs.ButtonToolbar>
            <bs.Button bsStyle="primary"
                       onClick={this.selectAmiSet.bind(this, '')}
                       disabled={this.state.selectedAmiSet === ''}>
              <bs.Glyphicon glyph="plus"/>
              &nbsp;
              Add AMI Set
            </bs.Button>
          </bs.ButtonToolbar>
        </bs.Col>
      </bs.Row>
      <span>{
        this.renderWaitFor('amiSets') || this.renderAmiSetsTable()
      }</span>
      </span>
    );
  },

  /** Render table of all AMI Sets */
  renderAmiSetsTable() {
    return this.renderWaitFor('amiSets') || (
      <bs.Table condensed hover className="ami-set-manager-table">
        <thead>
          <tr>
            <th>AmiSet</th>
          </tr>
        </thead>
        <tbody>
          {this.state.amiSet.map(this.renderAmiSetRow)}
        </tbody>
      </bs.Table>
    );
  },

  selectAmiSet(amiSet) {
    this.setState({selectedAmiSet: amiSet});
  }

});

// Export AmiSetManager
module.exports = AmiSetManager;
