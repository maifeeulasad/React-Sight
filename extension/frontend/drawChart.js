//  Created by Grant Kang, William He, and David Sally on 9/10/17.
//  Copyright © 2018 React Sight. All rights reserved.

import * as d3 from 'd3';
import { saveAs } from 'file-saver';
import { parseSvg } from 'd3-interpolate/src/transform/parse';
import updateStateProps from './state-props-panel';


// ************
// *** Main ***
// ************
// let i = 0; // probably not used
const duration = 500; // D3 animation time
let root; // root node
let treemap;
let selectedNode; // represents node that is hovered over

let hSlider = 10; // default horizontal node spacing
let vSlider = 10; // defualt vertical node spacing

const margin = { // default margins
  top: 100,
  right: 100,
  bottom: 100,
  left: 100,
};

const width = 1000 - margin.right - margin.left; // default width
const height = 960 - margin.top - margin.bottom; // default height

const minZoom = 0.05; // min zoom distance
const maxZoom = 2; // max zoom distance

/** D3 zoom object */
const zoom = d3.zoom()
  .scaleExtent([minZoom, maxZoom])
  .on('zoom', zoomed);

const xPos = width / 2;
const yPos = height / 6;

const transform = d3.zoomIdentity
  .translate(xPos, yPos)
  .scale(1);

/** D3 root element */
const svg = d3.select('.tree')
  .append('div')
  .classed('svg-container', true) // container class to make it responsive
  .append('svg')
  // responsive SVG needs these 2 attributes and no width and height attr
  .attr('preserveAspectRatio', 'xMinYMin meet')
  .attr('viewBox', `0 0 ${height} ${width}`)
  // class to make it responsive
  .classed('svg-content-responsive', true)
  .call(zoom)
  .append('g');

d3.select('#vSlider').on('input', () => {
  const val = document.querySelector('#vSlider').value;
  vSlider = val;
  update();
});

d3.select('#hSlider').on('input', () => {
  const val = document.querySelector('#hSlider').value;
  hSlider = val;
  update();
});

// center graph on page -> may not be needed
d3.select('svg').transition().duration(1).call(zoom.transform, transform);

// *************
// * Functions *
// *************

/** Built in D3 zoom function */
function zoomed() {
  svg.attr('transform', d3.event.transform);
}

/** Update the tree with new data
 *
 * @param {object} source - parsed representation of React's vDOM
 */
function update(source) {
  treemap = d3.tree()
    .nodeSize([hSlider * 5, hSlider * 5]);

  // Creates a curved (diagonal) path from parent to the child nodes
  const diagonal = (s, d) => `M${s.x},${s.y}C${s.x},${(s.y + d.y) / 2} ${d.x},${(s.y + d.y) / 2} ${d.x},${d.y}`;

  // Toggle children on click.
  const click = (d) => {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
    d3.selectAll('text').attr('class', 'text');
    update(d);
  };

  // Assigns the x and y position for the nodes
  const treeData = treemap(root);

  // Compute the new tree layout.
  const nodes = treeData.descendants();
  const links = treeData.descendants().slice(1);

  // Normalize for fixed-depth.
  nodes.forEach((d) => { d.y = d.depth * vSlider * 10; });

  // ****************** Nodes section ***************************

  // Update the nodes...
  const node = svg.selectAll('g.node')
    .data(nodes, (d) => {
      if (d.data.id === selectedNode) {
        updateStateProps(d.data.state, d.data.props);
      }
      return d.data.id;
    });

  // Remove any exiting nodes
  const nodeExit = node.exit().transition()
    .duration(duration)
    .attr('transform', () => `translate(${source.x},${source.y})`)
    // .attr('transform', d => 'translate(' + source.x + ',' + source.y + ')')
    .remove();

  const nodeEnter = node.enter().append('g')
    .attr('class', 'node')
    .attr('transform', () => `translate(${source.x0},${source.y0})`)
    .on('click', click);

  // Add Circle for the nodes
  nodeEnter.append('circle')
    .attr('class', 'node')
    .attr('r', 5)
    .style('fill', (d) => (d._children ? 'lightsteelblue' : '#fff'))
    .style('pointer-events', 'visible')

    .on('mouseover', function (d) {
      d3.selectAll('circle')
        .style('stroke-width', 1)
        .style('stroke', 'black');
      d3.select(this)
        .style('stroke-width', 5)
        .style('stroke', '#754abb');
      selectedNode = d.data.id;
      updateStateProps(d.data.state, d.data.props);

      const breadcrumb = document.querySelector('.breadcrumb');
      const items = breadcrumb.getElementsByTagName('*');
      for (let i = 0; i < items.length; i += 1) {
        const html = items[i].innerHTML;

        if (html === d.data.name) {
          items[i].style.color = '#B30089';
        } else if (html.slice(0, html.indexOf('[')) == d.data.name) {
          items[i].style.color = '#B30089';
        } else {
          items[i].style.color = '#0275d8';
        }
      }
    });
  // Add labels for the nodes
  nodeEnter.append('text')
    .attr('dy', '.35em')
    .attr('y', (d) => (d.children || d._children ? -24 : 24))
    .attr('text-anchor', 'middle')
    .text((d) => d.data.name);

  // UPDATE
  const nodeUpdate = nodeEnter.merge(node);

  // Transition to the proper position for the node
  nodeUpdate.transition()
    .duration(duration)
    .attr('transform', (d) => `translate(${d.x},${d.y})`);

  // Update the node attributes and style
  nodeUpdate.select('circle.node')
    .attr('r', 10)
    .style('fill', (d) => (d._children ? 'lightsteelblue' : '#fff'))
    .attr('cursor', 'pointer'); // On exit reduce the node circles size to 0
  nodeExit.select('circle')
    .attr('r', 1e-6);


  // On exit reduce the opacity of text labels
  nodeExit.select('text')
    .style('fill-opacity', 1e-6);

  // ****************** links section ***************************
  // Update the links...
  const link = svg.selectAll('path.link')
    .data(links, (d) => d.data.id);

  // Enter any new links at the parent's previous position.
  // Enter any new links at the parent's previous position.
  const linkEnter = link.enter().insert('path', 'g')
    .attr('class', 'link')
    .attr('d', (d) => {
      const o = { x: source.x0, y: source.y0 };
      return diagonal(o, o);
    });
  // UPDATE
  const linkUpdate = linkEnter.merge(link);

  // Transition back to the parent element position
  linkUpdate.transition()
    .duration(duration)
    .attr('d', (d) => diagonal(d, d.parent));

  // Remove any exiting links
  const linkExit = link.exit().transition()
    .duration(duration)
    .attr('d', (d) => {
      const o = { x: source.x, y: source.y };
      return diagonal(o, o);
    })
    .remove();

  // Store the old positions for transition.
  nodes.forEach((d) => {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}

export function drawChart(treeData) {
  // declares a tree layout and assigns the size
  treemap = d3.tree()
    .size([height - 500, width - 500]);
  // gi.nodeSize([30, 30])
  // Assigns parent, children, height, depth
  root = d3.hierarchy(treeData, (d) => d.children);
  root.x0 = height - 500 / 2;
  root.y0 = 0;
  update(root);

  // remove loading screen
  const loading = document.querySelector('.loading');
  if (loading) document.querySelector('.tree').removeChild(loading);
}

/** Zooms in D3 graph */
export function zoomIn() {
  const currentTransform = d3.select('.svg-content-responsive > g').attr('transform');
  const { translateX, translateY, scaleX } = parseSvg(currentTransform);
  let newZoom = scaleX * 1.5;
  newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

  const transform = d3.zoomIdentity
    .translate(translateX, translateY)
    .scale(newZoom);
  d3.select('.svg-content-responsive').transition().duration(1).call(zoom.transform, transform);
}

/** Zooms out D3 graph */
export function zoomOut() {
  const currentTransform = d3.select('.svg-content-responsive > g').attr('transform');
  const { translateX, translateY, scaleX } = parseSvg(currentTransform);
  let newZoom = scaleX / 1.5;
  newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

  const transform = d3.zoomIdentity
    .translate(translateX, translateY)
    .scale(newZoom);
  d3.select('.svg-content-responsive').transition().duration(1).call(zoom.transform, transform);
}


/** Graph download related */

// Source modified from: https://www.demo2s.com/javascript/javascript-d3-js-save-svg-to-png-image.html

function getSVGString(svgNode) {
  function contains(str, arr) {
    return arr.indexOf(str) !== -1;
  }

  function appendCSS(cssText, element) {
    const styleElement = document.createElement('style');
    styleElement.setAttribute('type', 'text/css');
    styleElement.innerHTML = cssText;
    const refNode = element.hasChildNodes() ? element.children[0] : null;
    element.insertBefore(styleElement, refNode);
  }

  function getCSSStyles(parentElement) {
    const selectorTextArr = [];

    // Add Parent element Id and Classes to the list
    selectorTextArr.push(`#${parentElement.id}`);
    for (let c = 0; c < parentElement.classList.length; c += 1) { if (!contains(`.${parentElement.classList[c]}`, selectorTextArr)) selectorTextArr.push(`.${parentElement.classList[c]}`); }

    // Add Children element Ids and Classes to the list
    const nodes = parentElement.getElementsByTagName('*');
    for (let i = 0; i < nodes.length; i += 1) {
      const { id } = nodes[i];
      if (!contains(`#${id}`, selectorTextArr)) { selectorTextArr.push(`#${id}`); }

      const classes = nodes[i].classList;
      for (let c = 0; c < classes.length; c += 1) { if (!contains(`.${classes[c]}`, selectorTextArr)) selectorTextArr.push(`.${classes[c]}`); }
    }

    // Extract CSS Rules
    let extractedCSSText = '';
    for (let i = 0; i < document.styleSheets.length; i += 1) {
      const s = document.styleSheets[i];

      // eslint-disable-next-line no-continue
      if (!s.cssRules) continue;

      const { cssRules } = s;
      for (let r = 0; r < cssRules.length; r += 1) {
        if (contains(cssRules[r].selectorText, selectorTextArr)) {
          extractedCSSText += cssRules[r].cssText;
        }
      }
    }


    return extractedCSSText;
  }


  svgNode.setAttribute('xlink', 'http://www.w3.org/1999/xlink');
  const cssStyleText = getCSSStyles(svgNode);
  appendCSS(cssStyleText, svgNode);

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgNode);
  svgString = svgString.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink='); // Fix root xlink without namespace
  svgString = svgString.replace(/NS\d+:href/g, 'xlink:href'); // Safari NS namespace fix

  return svgString;
}


function svgString2Image(svgString, widthGraph, heightGraph, format, callback) {
  // eslint-disable-next-line no-param-reassign
  format = format || 'png';

  const imgsrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`; // Convert SVG string to data URL
  // const urlTem = imgsrc.replace(/^data:image\/[^;]+/, 'data:application/octet-stream');
  // window.open(urlTem);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = widthGraph;
  canvas.height = heightGraph;

  const image = new Image();
  function loadImage() {
    window.open('https://www.twitter.com/', '_blank');
    context.clearRect(0, 0, widthGraph, heightGraph);
    context.drawImage(image, 0, 0, widthGraph, heightGraph);

    canvas.toBlob((blob) => {
      window.open('https://www.twitter.com/', '_blank');
      if (callback) {
        window.open('https://www.twitter.com/', '_blank');
        callback(blob);
      }
    });
  }
  image.addEventListener('load', loadImage, false);
  image.src = imgsrc;
}


/** Save D3 graph */
function save(dataBlob) {
  saveAs(dataBlob, 'D3 vis exported to PNG.png');
  // const objectURL = URL.createObjectURL(dataBlob);
  // window.open(objectURL, '_blank');
  // window.open('https://www.google.com/', '_blank');
  // const { log } = chrome.extension.getBackgroundPage().console;
  // log(objectURL);
  // chrome.tabs.create({ url: objectURL });
}


/** Download D3 graph */
export function downloadGraph() {
  const svgString = getSVGString(svg.node());
  svgString2Image(svgString, 2 * width, 2 * height, 'png', save);
}
