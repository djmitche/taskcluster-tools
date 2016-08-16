const React = require('react');
const bs = require('react-bootstrap');
const path = require('path');
const $ = require('jquery');
const WWW_Authenticate = require('www-authenticate').parsers.WWW_Authenticate;
const ReactTooltip = require("react-tooltip");
const config = require("../build/status/config")
const format = require('../lib/format');

// Make a request to the cors proxy service
function makeRequest(options, allowHeaders = []) {
  let headers = {};

  if (allowHeaders) {
    headers['X-Cors-Proxy-Expose-Headers'] = allowHeaders.join(', ');
  }

  return $.ajax({
    url: config.CORS_PROXY,
    method: 'POST',
    contentType: 'application/json',
    headers,
    data: JSON.stringify(options)
  });
}

function pollTaskclusterService(key, cb) {
  return $.getJSON(`http://api.uptimerobot.com/getMonitors?apiKey=${key}&format=json&noJsonCallback=1`)
    .done(res => {
      const [ monitor ] = res.monitors.monitor;

      cb(monitor.status === '2' ? 'up' : 'down');  // 2 is 'up'
    }).fail(err => {
      console.error('Error fetching data from uptimerobot');
      console.error(err);
      cb('err');
    });
}

function dummyPoll(cb) {
  setTimeout(cb.bind(null, true), 0);
}

let taskclusterServices = [
  {
    name: "Queue",
    poll: pollTaskclusterService.bind(null, config.UPTIMEROBOT_API_KEY_QUEUE),
    link: "https://queue.taskcluster.net/v1/ping",
    description: "queue.taskcluster.net"
  },
  {
    name: "Auth",
    poll: pollTaskclusterService.bind(null, config.UPTIMEROBOT_API_KEY_AUTH),
    link: "https://auth.taskcluster.net/v1/ping",
    description: "auth.taskcluster.net"
  },
  {
    name: "AWS Provisioner",
    poll: pollTaskclusterService.bind(null, config.UPTIMEROBOT_API_KEY_AWS_PROVISIONER),
    link: "https://aws-provisioner.taskcluster.net/v1/ping",
    description: "aws-provisioner.taskcluster.net"
  },
  {
    name: "Events",
    poll: pollTaskclusterService.bind(null, config.UPTIMEROBOT_API_KEY_EVENTS),
    link: "https://events.taskcluster.net/v1/ping",
    description: "events.taskcluster.net"
  },
  {
    name: "Index",
    poll: pollTaskclusterService.bind(null, config.UPTIMEROBOT_API_KEY_INDEX),
    link: "https://index.taskcluster.net/v1/ping",
    description: "index.taskcluster.net"
  },
  {
    name: "Scheduler",
    poll: pollTaskclusterService.bind(null, config.UPTIMEROBOT_API_KEY_SCHEDULER),
    link: "https://scheduler.taskcluster.net/v1/ping",
    description: "https://scheduler.taskcluster.net"
  },
  {
    name: "Secrets",
    poll: pollTaskclusterService.bind(null, config.UPTIMEROBOT_API_KEY_SECRETS),
    link: "https://secrets.taskcluster.net/v1/ping",
    description: "https://secrets.taskcluster.net"
  }
];

let otherServices = [
  {
    name: "AWS",
    description: "Amazon Elastic Compute Cloud (Oregon)",
    link: "http://status.aws.amazon.com/",
    poll: async function(cb) {
      try {
        let data = await Promise.resolve(makeRequest({
          url: 'http://status.aws.amazon.com/rss/ec2-us-west-2.rss'
        }));

        let items = data.getElementsByTagName('item');
        if (!items.length) {
          cb('up');
          return;
        }

        let title = items[0].getElementsByTagName('title');
        cb(title[0].innerHTML.startsWith('Service is operating normally') ? 'up' : 'down');
      } catch (err) {
        console.log(err.stack || err);
        cb('down');
      }
    }
  },
  {
    name: "Docker Registry",
    description: "Docker images provider",
    link: "https://index.docker.io/",

    // Authentication procedure is described at
    // https://docs.docker.com/registry/spec/auth/token/
    poll: async function(cb) {
      let req;

      try {
        req = makeRequest({
          url: 'https://index.docker.io/v2/',
        }, [
          'www-authenticate'
        ]);

        await Promise.resolve(req);
      } catch (err) {
        if (err.status != 401) {
          cb('down');
          return;
        }

        try {
          let auth = new WWW_Authenticate(req.getResponseHeader('www-authenticate'));

          let data = await Promise.resolve(makeRequest({
            url: `${auth.parms.realm}?service=${auth.parms.service}`
          }));

          await Promise.resolve(makeRequest({
            url: 'https://index.docker.io/v2/',
            method: 'GET',
            headers: {
              Authorization: `${auth.scheme} ${data.token}`
            }
          }));
        } catch (err) {
          console.log(err.stack || err);
          cb('err');
          return;
        }
      }

      cb('up');
    }
  },
  {
    name: "Heroku",
    description: "https://status.heroku.com/",
    link: "https://status.heroku.com/",
    poll: function(cb) {
      Promise.resolve(makeRequest({
        url: 'https://status.heroku.com/feed'
      }))
      .then(data => cb((!data.length || data[0].title.startsWith('Resolved')) ? 'up' : 'down'))
      .catch(err => {
        console.log(err || err.stack);
        cb('err');
      });
    }
  }
];

const STATUS_DISPLAY = {
  loading: { icon: 'spinner', spin: true, color: 'gray' },
  up: { icon: 'thumbs-up', color: 'green' },
  degraded: { icon: 'exclamation', color: 'orange' },
  down: { icon: 'thumbs-down', color: 'red' },
  err: { icon: 'frown-o', color: 'red' },
};

export let StatusChecker = React.createClass({
  propTypes: {
    status: React.PropTypes.string.isRequired
  },
  render: function() {
    const { icon, spin, color } = STATUS_DISPLAY[this.props.status] || STATUS_DISPLAY['err'];
    return (
        <format.Icon
          name={icon}
          size="lg"
          spin={spin}
          className="pull-left"
          style={{ color }} />
    );
  }
});

export let Service = React.createClass({
  propTypes: {
    name: React.PropTypes.string.isRequired,
    description: React.PropTypes.string.isRequired,
    link: React.PropTypes.string.isRequired,
    poll: React.PropTypes.func.isRequired
  },

  componentWillMount() {
    this.poll();
  },

  componentWillUnmount() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  },

  poll() {
    this.props.poll(status => {
      this.setState({ status });
      this.timer = setTimeout(this.poll, 5000);
    });
  },

  getInitialState() {
    return {
      status: 'loading',
    };
  },

  render: function() {
    return (
      <div className="form-horizontal service-status-container">
        <a target="_blank" href={this.props.link}>
          <div data-tip data-for={this.props.name}>
            <label className="service-status"><StatusChecker status={this.state.status} /></label>
            <label className="service-status">{this.props.name}</label>
          </div>
        </a>
        <ReactTooltip id={this.props.name} place="top" type="info" effect="float">
          <span>{this.props.description}</span>
        </ReactTooltip>
      </div>
    );
  }
});

export let ServiceGroup = React.createClass({
  PropTypes: {
    name: React.PropTypes.string.isRequired,
    services: React.PropTypes.array.isRequired,
    description: React.PropTypes.string.isRequired
  },
  render() {
    return (
      <bs.Col className="service-group" md={6} sm={12}>
        <h2 data-tip data-for={this.props.name}>{this.props.name}</h2>
        <bs.ButtonToolbar>
          {this.props.services.map(service => {
            return <Service
              name={service.name}
              key={service.name}
              poll={service.poll}
              description={service.description}
              link={service.link}
            />;
          })}
        </bs.ButtonToolbar>
        <ReactTooltip id={this.props.name} place="top" type="info" effect="float">
          <span>{this.props.description}</span>
        </ReactTooltip>
      </bs.Col>
    );
  }
});

export let TaskclusterDashboard  = React.createClass({
  render: function() {
    return (
      <div>
        <bs.Row>
          <ServiceGroup name="Taskcluster Services" services={taskclusterServices} description="Taskcluster services" />
          <ServiceGroup name="External Services" services={otherServices} description="External services Taskcluster depends on" />
        </bs.Row>
      </div>
    );
  }
});
