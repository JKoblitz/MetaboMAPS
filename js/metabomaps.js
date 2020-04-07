var group = {}
var metaboliteIDs = {
  "Citrate": "915",
  "Isocitrate": "1597",
  "2-oxoglutarate": "3064",
  "succinyl-coa": "1071",
  "succinate": "396",
  "fumarate": "2638",
  "malate": "760",
  "oxaloacetate": "484",
  "acetyl-coa": "4880",
  "coenzyme_a": "3770"
}


function identifierIdentification(identifier, type = "R") {
  if (identifier === null || identifier === undefined) {
    return ""
  }
  if (type == "M") {
    var result = ""
    var dbs = {
      B: "<a title='BRENDA Ligand' href='https://www.brenda-enzymes.org/ligand.php?brenda_group_id=*' target='_blank' class='icon icon-B'>B</a>",
      K: "<a title='KEGG Compound' href='https://www.genome.jp/dbget-bin/www_bget?*' target='_blank' class='icon icon-K'>K</a>",
      S: "<a title='Sabio-RK' href='http://sabio.h-its.org/compdetails.jsp?cid=*' target='_blank' class='icon icon-S'>S</a>",
      M: "<a title='MetaCyc' href='https://metacyc.org/compound?id=*' target='_blank' class='icon icon-M'>M</a>"
    }
    identifier = identifier.split(",")
    identifier.forEach(function (d) {
      var id = d.split(":")[1]
      if (id && id != "NULL" && id != 0 && id != "") {
        result += dbs[d.split(":")[0]].replace("*", id)
      }
    })
    return result
  }
  var patterns = [
    { regex: /^(?:C|G|R|RC|D|K)\d{5}$/, name: "KEGG", link: "<a title='KEGG Compound' href='https://www.genome.jp/dbget-bin/www_bget?*' target='_blank' class='icon icon-K'>K</a>" },
    { regex: /^\d\.\d+\.\d+\.\d+$/, name: "EC Number", link: "<a title='BRENDA Enzyme' href='https://www.brenda-enzymes.org/enzyme.php?ecno=*' target='_blank' class='icon icon-B'>B</a>" },
    { regex: /^[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/, name: "UniProt", link: "<a title='UniProt' href='https://www.uniprot.org/uniprot/*' target='_blank' class='icon icon-U'>U</a>" },
  ]
  var ec = /^\d\.\d+\.\d+\.\d+$/
  for (const ind in patterns) {
    const ptrn = patterns[ind];
    if (ptrn.regex.test(identifier)) {
      const link = ptrn.link.replace("*", identifier)
      return link;
    }
  }
  return "";
}


function autoDelimiter(x) {
  var delimiters = [',', ';', '\t', '|'];
  var results = [];

  delimiters.forEach(function (delimiter) {
    var res = d3.dsvFormat(delimiter).parse(x);
    if (res.length >= 1) {
      var count = keyCount(res[0]);
      for (var i = 0; i < res.length; i++) {
        if (keyCount(res[i]) !== count) return;
      }
    }
    results.push({
      delimiter: delimiter,
      arity: Object.keys(res[0]).length,
    });
  });

  if (results.length) {
    return results.sort(function (a, b) {
      return b.arity - a.arity;
    })[0].delimiter;
  } else {
    return null;
  }
}

function keyCount(o) {
  return (typeof o == 'object') ? Object.keys(o).length : 0;
}

function openDataFiles(file, type) {
  d3.csv(file)
    .then(function (csv) {
      data[type] = csv
    })
    .catch(function (error) {
      console.log(error);
    })
}

$("#plot").on("click", function () {
  // remove previous plot boxes:
  svg.selectAll("g.plot-boxes > *").remove()
  if (data["met"].length != 0) {
    plotData("met")
  }
  if (data["trans"].length != 0) {
    plotData("trans")
  }
})

function plotData(type = "trans") {
  group = {}
  // get data information
  var header = data[type].columns.slice(1, data[type].columns.length)
  var id_head = data[type].columns[0]
  var identifiers = data[type].map((v) => v[id_head])

  // set the range parameter for visualization
  range = {
    min: parseFloat($("#min_" + type).val()),
    zero: parseFloat($("#zero_" + type).val()),
    max: parseFloat($("#max_" + type).val())
  }
  if (isNaN(range.min)) {
    var minRow = data[type].map(function (row) {
      return Math.min.apply(Math, Object.values(row).slice(1, row.length));
    });
    range.min = Math.min.apply(Math, minRow.filter(Boolean));
  }

  if (isNaN(range.max)) {
    var maxRow = data[type].map(function (row) {
      return Math.max.apply(Math, Object.values(row).slice(1, row.length));
    });
    range.max = Math.max.apply(Math, maxRow.filter(Boolean));
  }

  var plotType = $("#type_" + type).val()

  // define color scheme
  var colorCount = header.length
  if (plotType == "groupbar") {
    header.forEach(function (d) {
      d = d.split("_")
      if (d[0] in group) {
        group[d[0]].push(d[1])
      } else {
        group[d[0]] = [d[1]]
      }
    })
    colorCount /= Object.keys(group).length
  }
  var colorScheme = $("#color_" + type).val()
  var colorsCategorical = ["Category10", "Paired", "Tableau10", "Set3"]
  var colorsRadial = ["Spectral", "Cool", "Viridis", "Plasma", "Inferno", "Rainbow"]
  var colorsDiverging = ["RdBu", "RdGy", "BrBG", "PiYG", "RdYlBu"]
  if (plotType != "heat" && plotType != "circle") {
    if (colorsCategorical.includes(colorScheme)) {
      var colorScale = d3.scaleOrdinal(d3["scheme" + colorScheme])
    } else if (colorsRadial.includes(colorScheme)) {
      var colorScale = d3.scaleSequential(d3["interpolate" + colorScheme])
        .domain([1, colorCount])
    } else {
      // this throws an error, if range < 3:
      var colorScale = d3.scaleOrdinal(d3["scheme" + colorScheme][Math.max(colorCount, 3)])
    }
  } else if (!isNaN(range.zero)) {
    var colorScale = d3.scaleDiverging()
      .interpolator(d3["interpolate" + colorScheme])
      .domain([range.min, range.zero, range.max])
  } else {
    var colorScale = d3.scaleSequential()
      .interpolator(d3["interpolate" + colorScheme])
      .domain([range.min, range.max])
  }

  // iterate through data and generate graphes
  for (row in data[type]) {
    var dataRow = data[type][row]
    var ident = dataRow[id_head]
    if (type == "met") {
      ident = metaboliteIDs[ident] || ident;
    }
    if (ident === undefined) continue;
    if (ident.toLowerCase() in id2plotbox) {
      var identifiers = id2plotbox[ident.toLowerCase()]
    } else if (ident in id2plotbox) {
      var identifiers = id2plotbox[ident]
    } else {
      continue
    }

    for (i in identifiers) {
      var element = svg.select("#pb" + identifiers[i])
      var len = element.selectAll(".plot-box-" + type).nodes().length
      element = element.append("g").classed("plot-box-" + type, true).classed("plot-box", true)
        .attr("transform", "translate(0," + (height + 3) * len + ")")
        .attr("identifier", dataRow[id_head])
        .attr("values", Object.values(dataRow).slice(1, Object.values(dataRow).length))
      plot(plotType, element, dataRow, header, colorScale)
    }
  }

  // trigger selection for multiple plot boxes
  svg.selectAll(".plot-boxes")
    .each(function () {
      var plotbox = d3.select(this)
      var len = plotbox.selectAll(".plot-box-" + type).nodes().length
      if (len > 1) {
        var val = new Array(header.length).fill([]);
        plotbox.selectAll(".plot-box-" + type).each(function () {
          var data = d3.select(this).attr("values").split(",")
          for (let i = 0; i < data.length; i++) {
            val[i] = val[i].concat([data[i]])
          }
        })
        var result = ["average"];

        for (var i = 0; i < val.length; i++) {
          result.push(average(val[i]));
        }

        element = plotbox.append("g").classed("plot-box-" + type, true).classed("plot-box", true)
          .attr("transform", "translate(0," + (height + 3) * len + ")")
          .attr("identifier", "average")
        plot(plotType, element, result, header, colorScale)

      }
    })
    .on("click", function () {
      var plotbox = d3.select(this)
      plotbox.selectAll(".plot-box").style("display", "block").classed("open", true)
        .each(function () {
          d3.select(this)
            .append("text").classed("temp", true)
            .attr("dx", width + 3)
            .attr("dy", height / 2)
            .text(d3.select(this).attr("identifier"))
        })
        .on("click", function () {
          d3.select(this).lower()
          plotbox.selectAll(".plot-box").transition().attr("transform", (d, i) => "translate(0," + (height + 3) * i + ")")
          plotbox.selectAll(".plot-box").style("display", "").classed("open", false)
            .on("click", function () { })
          plotbox.selectAll(".temp").remove()
          d3.event.stopPropagation()
        })
      plotbox.insert("rect").classed("temp", true).attr("x", -2).attr("y", -2)
        .attr("width", this.getBBox().width + 4)
        .attr("height", this.getBBox().height + 4).lower()
    })

  function plot(plotType, element, dataRow, header, colorScale) {
    // function handle for plotting
    switch (plotType) {
      case "heat":
        drawHeatmap(element, Object.values(dataRow), header, colorScale)
        break;
      case "bar":
        drawBarchart(element, Object.values(dataRow), header, colorScale, log = false, groups = null)
        break;
      case "logbar":
        drawBarchart(element, Object.values(dataRow), header, colorScale, log = true, groups = null)
        break;
      case "groupbar":
        drawBarchart(element, Object.values(dataRow), header, colorScale, log = false, groups = Object.keys(group).length)
        break;
      case "line":
        drawLinechart(element, Object.values(dataRow), header, colorScale)
        break;
      case "pie":
        drawPiechart(element, Object.values(dataRow), header, colorScale)
        break;
      case "circle":
        drawCircleHeatmap(element, Object.values(dataRow), header, colorScale)
        break;
      default:
        break;
    }
  }

  // add legends
  $("#legendCard").show()
  if (type == "trans") {
    d3.selectAll("p.legend-label-trans").remove()
    d3.select("#legendSVG").append("p").text("Reactions:").attr("class", "legend-label-trans")
  } else {
    d3.selectAll("p.legend-label-met").remove()
    d3.select("#legendSVG").append("p").text("Metabolites:").attr("class", "legend-label-met")
  }

  d3.selectAll("svg.legend-cat-" + type).remove()
  d3.selectAll("svg.legend-color-" + type).remove()

  if (plotType == "heat" || plotType == "circle") {
    legendColorLinear(type, colorScale)
  } else if (plotType == "bar" || plotType == "logbar" || plotType == "pie" || plotType == "groupbar") {
    legendColorCategorical(type, colorScale, header)
  } else if (plotType == "line") {
    svg.selectAll("g.legend-color-" + type).remove()
  }
  legendOrderCategorical(type, plotType, header, colorScale)
}

function legendOrderCategorical(type, plotType, header, colorScale) {
  // draw categorical order legends
  // pie chart annotations are not supported
  if (plotType == "pie") return;

  var barWidth = (width * 1.7) / header.length
  if ((header.length > 5 && plotType == "heat") || (header.length > 7 && plotType == "circle")) {
    var half_length = Math.ceil(header.length / 2);
    barWidth = (width * 1.7) / half_length;
  }
  var m = {
    t: 15,
    b: 10,
    l: 10,
    r: 10
  }
  var legendsvg = d3.select("#legendSVG").append("svg")
    .attr("width", "200")
    .attr("height", "100")
    .classed("legend-cat-" + type, true)
    .style("font-family", "ArialMT, Arial")
    .style("font-size", "small");
  var legendg = legendsvg.append("g").classed("plot", true)
    .attr("transform", "translate(" + m.l + "," + m.t + ")")

  var plotArea = legendg.append("g").attr("id", "legend-cat-plot-" + type).attr('transform', 'scale(1.7)')
  var values = ["id"];
  switch (plotType) {
    case "heat":
      var step = (range.max - range.min) / (header.length - 1)
      for (let i = 0; i < header.length; i++) {
        values.push(0) //(range.min + (step * i))
      }
      drawHeatmap(plotArea, values, header, colorScale)
      break;
    case "circle":
      var step = (range.max - range.min) / (header.length - 1)
      for (let i = 0; i < header.length; i++) {
        values.push(0) //(range.min + (step * i))
      }
      drawCircleHeatmap(plotArea, values, header, colorScale)
      break;
    case "line":
      var minval = 0.4 * range.max
      var step = (range.max - minval) / (header.length - 1)
      for (let i = 0; i < header.length; i++) {
        values.push(minval + (step * i))
      }
      drawLinechart(plotArea, values, header, colorScale)
      break;
    case "groupbar":
      var minval = 0.4 * range.max
      var step = (range.max - minval) / (header.length - 1)
      for (let i = 0; i < header.length; i++) {
        values.push(minval + (step * i))
      }
      barWidth = (width * 1.7) / Object.keys(group).length
      drawBarchart(plotArea, values, header, colorScale, log = false, groups = Object.keys(group).length)
      break;
    default:
      var minval = 0.4 * range.max
      var step = (range.max - minval) / (header.length - 1)
      for (let i = 0; i < header.length; i++) {
        values.push(minval + (step * i))
      }
      drawBarchart(plotArea, values, header, colorScale)
      break;
  }

  if (plotType == "groupbar") {
    var space = 6 / (Object.keys(group).length - 1)
    legend = legendg.selectAll("legend")
      .data(Object.keys(group))
      .enter()
      .append("g")
      .attr("transform", function (_, i) {
        return "translate(" + (i * barWidth + space * i) + "," + (height * 1.7) + ")"
      })
    legend.append("text")
      .attr("dy", barWidth / 2 + 3)
      .attr('dx', -7)
      .style("text-anchor", "end")
      .style("font-size", 8)
      .attr("transform", "rotate(270)")
      .text(function (d) {
        return d
      })
  } else if ((header.length <= 5 || plotType != "heat") && (header.length <= 7 || plotType != "circle")) {
    legend = legendg.selectAll("legend")
      .data(header)
      .enter()
      .append("g")
      .attr("transform", function (_, i) {
        return "translate(" + i * barWidth + "," + height * 1.7 + ")"
      })
    legend.append("text")
      .attr("dy", barWidth / 2 + 3)
      .attr('dx', 0)
      .style("text-anchor", "end")
      .style("font-size", 8)
      .attr("transform", "rotate(270)")
      .text(function (d) {
        return d + " -"
      })

  } else {
    // more than 5 values and heatmap
    legend = legendg.selectAll("legend")
      .data(header)
      .enter()
      .append("g")
      .attr("transform", function (_, i) {
        if (i < half_length) {
          return "translate(" + ((i * barWidth)) + "," + 0 + ")";
        }
        return "translate(" + (((i - half_length) * barWidth)) + "," + (0 + (height * 1.7) / 2) + ")";
      })
    legend.append("text")
      .attr("x", function (d, i) {
        if (i < half_length) {
          return 0
        }
        return -(height * 1.7) / 2
      })
      .attr("y", (barWidth - 1) / 2)
      .attr("transform", "rotate(270)")
      .style("font-size", "8.966")
      .style("font-family", "ArialMT, Arial")
      .style("fill", "black")
      .attr("dy", ".35em")
      .style("text-anchor", function (d, i) {
        if (i < half_length) {
          return "start";
        }
        return "end"
      })
      .text(function (d, i) {
        if (i < half_length) {
          return "- " + d
        }
        return d + " -";
      });
  }

  // modify SVG to match the outer margins of the legend
  var bbox = legendg.node().getBBox()
  legendsvg.attr("width", bbox.width + m.l + m.r)
    .attr("height", bbox.height + m.t + m.b)
    .attr("viewBox", (bbox.x) + " " + (bbox.y) + " " + (bbox.width + m.l + m.r) + " " + (bbox.height + m.t + m.b))
}

function legendColorCategorical(type, colorScale, header) {
  // draw categorical color legends
  var m = {
    t: 15,
    b: 10,
    l: 10,
    r: 10
  }
  var legendsvg = d3.select("#legendSVG").append("svg")
    .attr("width", "200")
    .attr("height", "100")
    .classed("legend-color-" + type, true)
    .style("font-family", "ArialMT, Arial")
    .style("font-size", "small");
  legendg = legendsvg.append("g").classed("plot", true)
    .attr("transform", "translate(" + m.l + "," + m.t + ")")

  legend = legendg.selectAll("legend")
    .data(!isEmpty(group) ? Object.values(group)[0] : header)
    .enter()
    .append("g")
    .attr("transform", function (_, i) {
      return "translate(0," + i * 16 + ")"
    })

  legend.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', 28)
    .attr('height', 13)
    .attr('rx', 0)
    .attr('ry', 0)
    .attr('fill', function (_, i) {
      if (!isEmpty(group)) {
        var members = Object.values(group)[0].length
        if (members != 2) return colorScale(Math.ceil(i % (members)) + 1);
        if (Math.ceil(i % (members)) == 1) { return colorScale(3); }
        return colorScale(1)
      }
      return colorScale(i + 1)
    })
    .style('stroke', "black")
    .style('stroke-width', '1');
  legend.append("text")
    .attr("dy", 10)
    .attr('dx', 28 + 10)
    .attr('text-anchor', "start")
    .style("font-size", 8)
    .text(function (d) {
      return d
    })

  legendsvg.attr("width", legendg.node().getBBox().width + m.l + m.r)
    .attr("height", legendg.node().getBBox().height + m.t + m.b)
}

function legendColorLinear(type, colorScale) {
  var m = {
    t: 15,
    b: 10,
    l: 10,
    r: 10
  }

  var domain = colorScale.domain(),
    steps = []

  if (domain.length == 3) {
    steps = [
      domain[0],
      domain[1] - ((domain[1] - domain[0]) / 2),
      domain[1],
      domain[2] - ((domain[2] - domain[1]) / 2),
      domain[2]
    ]
  } else if (domain.length == 2) {
    steps = (domain[1] - domain[0]) / 4
    steps = [
      domain[0],
      domain[0] + steps,
      domain[0] + steps * 2,
      domain[0] + steps * 3,
      domain[1]
    ]
  } else {
    steps = maxData / 5
    steps = [steps, steps * 2, steps * 3, steps * 4, steps * 5]
  }
  var legendsvg = d3.select("#legendSVG").append("svg")
    .attr("width", "200")
    .attr("height", "100")
    .classed("legend-color-" + type, true)
    .style("font-family", "ArialMT, Arial")
    .style("font-size", "small");
  legendg = legendsvg.append("g").classed("plot", true)
    .attr("transform", "translate(" + m.l + "," + m.t + ")")
  legend = legendg.selectAll("legend")
    .data(steps)
    .enter()
    .append("g")
    .attr("transform", function (d, i) {
      return "translate(0," + i * 16 + ")"
    })
  legend.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', 28)
    .attr('height', 13)
    .attr('rx', 0)
    .attr('ry', 0)
    .attr('fill', function (d) {
      return colorScale(d)
    })
    .style('stroke', "black")
    .style('stroke-width', '1');
  legend.append("text")
    .attr("dy", 10)
    .attr('dx', 28 + 10)
    .attr('text-anchor', "start")
    .style("font-size", 8)
    .text(function (d) {
      return d.toFixed(1)
    })

  legendsvg.attr("width", legendg.node().getBBox().width + m.l + m.r)
    .attr("height", legendg.node().getBBox().height + m.t + m.b)
}



function drawHeatmap(element, dataArray, header, colorScale) {
  // plot function for heatmaps
  var values = dataArray.slice(1, dataArray.length);

  if (header.length <= 5) {
    var barWidth = width / values.length;
  } else {
    var barWidth = width / Math.ceil(values.length / 2);
  }

  plot = element.selectAll("plot")
    .data(values);

  if (values.length > 1 && values.length <= 5) {
    heatmap = plot.enter().append("g").classed("plot", true)
      .attr("transform", function (d, i) {
        return "translate(" + ((i * barWidth)) + "," + 0 + ")";
      });
    heatmap.append("title")
      .text(function (d, i) {
        if (d === "") return header[i] + ": NA (" + dataArray[0] + ")";
        return header[i] + ": " + Math.round(d * 100) / 100 + " (" + dataArray[0] + ")";
      });
    heatmap.append("rect")
      .style('stroke', function (d) {
        if (d === "") return "none";
        return "black";
      })
      .style('stroke-width', '0.8')
      .attr("height", height)
      .attr("width", barWidth - 1)
      .style("fill", function (d) {
        if (d === "") return "none";
        return colorScale(d);
      });
  } else if (values.length > 5) {
    var half_length = Math.ceil(values.length / 2);
    heatrows = plot.enter().append("g").classed("plot", true)
      .attr("transform", function (d, i) {
        if (i < half_length) {
          return "translate(" + ((i * barWidth)) + "," + 0 + ")";
        }
        return "translate(" + (((i - half_length) * barWidth)) + "," + (0 + height / 2) + ")";
      });
    heatrows.append("title")
      .text(function (d, i) {
        if (d === "") return header[i] + ": NA (" + dataArray[0] + ")";
        return header[i] + ": " + Math.round(d * 100) / 100 + " (" + dataArray[0] + ")";
      });
    heatrows.append("rect")
      .style('stroke', function (d) {
        if (d === "") return "none";
        return "black";
      })
      .style('stroke-width', '0.8')
      .attr("height", height / 2 - 1)
      .attr("width", barWidth - 1)
      .style("fill", function (d) {
        if (d === "") return "none";
        return colorScale(d);
      });
  } else {
    symbolplot = plot.enter().append("g").classed("plot", true);
    symbolplot.append("title")
      .text(function (d, i) {
        if (d === "") return header[i] + ": NA (" + dataArray[0] + ")";
        return header[i] + ": " + Math.round(d * 100) / 100 + " (" + dataArray[0] + ")";
      });
    symbolplot.append('path')
      .attr("d", d3.symbol().type(function (d) {
        if (isNaN(range.zero)) return d3.symbolSquare;
        if ((d > (range.zero + range.max * 0.05)) || (d < (range.zero + range.min * 0.05))) {
          return d3.symbolTriangle;
        }
        return d3.symbolCircle;
      }).size(140))
      .style('stroke', function (d) {
        if (d === "") return "none";
        return "black";
      })
      .style('stroke-width', '0.8')
      .attr("transform", function (d) {
        if (!isNaN(range.zero) && d < (range.zero + range.min * 0.05)) {
          return "translate(" + width / 2 + "," + height / 2 + ") rotate(180)";
        }
        return "translate(" + width / 2 + "," + height / 2 + ")";
      })
      .attr("height", height)
      .style("fill", function (d) {
        if (d === "") return "none";
        return colorScale(d);
      });
  }
}

function drawBarchart(element, dataArray, header, colorScale, log = false, groups = null) {
  // plot function for barcharts

  var values = dataArray.slice(1, dataArray.length);
  var spaceBetween = 6;
  var barWidth = (width - 1) / values.length;
  var members = header.length

  if (groups) {
    spaceBetween /= (groups - 1)
    barWidth = (width - 6 - 1) / values.length
    members /= groups
  }
  var space = 1
  drawPlotBg(element);
  bar = element.append("g").classed("plot", true)
  bar = bar.selectAll("plot")
    .data(values)
    .enter().append("g")
    .attr("transform", function (d, i) {
      if (i % (members) == 0 && i != 0) {
        space += spaceBetween
      }
      return "translate(" + ((i * barWidth) + space) + "," + (0) + ")";
    });

  bar.append("title")
    .text(function (d, i) {
      if (d === "") {
        return header[i] + ": NA (" + dataArray[0] + ")";
      } else {
        return header[i] + ": " + Math.round(d * 100) / 100 + " (" + dataArray[0] + ")";
      }
    });
  bar.append("rect")
    .attr("y", function (d) {
      if (d === "") {
        d3.select(this.parentNode)
          .append("text").html("*")
          .attr("y", height).attr("x", barWidth / 2)
          .style("text-anchor", "middle")
          .style("font-size", "small")
        return 0
      }
      if (log) {
        if (d == 0) {
          return 0;
        }
        md = Math.log10(d);
        mD = Math.log10(range.max);
      } else {
        md = d;
        mD = range.max;
      };
      var h = height - md / mD * height + 1
      if (h < 0) {
        d3.select(this.parentNode)
          .append("line")
          .attr("x1", 1)
          .attr("x2", barWidth)
          .attr("y1", -2)
          .attr("y2", -2)
          .style("stroke", "black")
          .style("stroke-width", 0.8);

        return 0
      }
      return h
    })
    .attr("x", 1)
    .attr("height", function (d) {
      if (d === "") {
        return 0
      }
      if (log) {
        if (d == 0) {
          return 0;
        }
        md = Math.log10(d);
        mD = Math.log10(range.max);
      } else {
        md = d;
        mD = range.max;
      };
      var h = md / mD * height - 1
      if (h > height) return height
      return h
    })
    .attr("width", barWidth - 1)
    .style("fill", function (d, i) {
      if (d === "") return "none";
      if (groups) {
        if (members != 2) return colorScale(Math.ceil(i % (members)) + 1);
        if (Math.ceil(i % (members)) == 1) { return colorScale(3); }
        return colorScale(1)
      }
      return colorScale(i + 1);
    })
    .style("stroke", "black")
    .style("stroke-width", 0.8);

}

function drawLinechart(element, dataArray, header, colorScale) {
  // plot function for line charts

  var values = dataArray.slice(1, dataArray.length);
  var barWidth = width / values.length;

  drawPlotBg(element);

  var barWidth = (width - 2) / (values.length - 1);
  var line = d3.line()
    .x(function (d, i) {
      return i * barWidth
    })
    .y(function (d) {
      return height - d / range.max * height
    })
    .defined(function (d) {
      return d;
    });

  linechart = element.append("g").classed("plot", true)
  linechart.append("path")
    .attr("fill", "none")
    .attr("stroke", colorScale(header.length))
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("stroke-width", 1)
    .attr("d", line(values));

  linechart = linechart.selectAll("g")
    .data(values)
    .enter().append("g")
    .attr("transform", function (d, i) {
      return "translate(" + ((i * barWidth)) + "," + (0) + ")";
    });
  linechart.append("title")
    .text(function (d, i) {
      if (d === "") return header[i] + ": NA (" + dataArray[0] + ")";
      return header[i] + ": " + Math.round(d * 100) / 100 + " (" + dataArray[0] + ")";
    });
  linechart.append("circle")
    .attr("cy", function (d) {
      return height - d / range.max * height
    })
    .attr("cx", 0)
    .attr("r", 2)
    .style("fill", function (d) {
      if (d === "") return "none"
      return colorScale(header.length + 1);
    });
}

function drawPiechart(element, dataArray, header, colorScale) {
  // plot function for pie charts

  var values = dataArray.slice(1, dataArray.length);

  var pie = d3.pie()
    .value(function (d) {
      return d.value;
    })
  var data_ready = pie(d3.entries(values))

  // Build the pie chart: Basically, each part of the pie is a path that we build using the arc function.
  var piechart = element
    .append("g").classed("plot", true)
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
    .selectAll('whatever')
    .data(data_ready)
    .enter()
  piechart.append('path')
    .attr('d', d3.arc()
      .innerRadius(0)
      .outerRadius(height / 2)
    )
    .attr('fill', function (d, i) {
      return (colorScale(i + 1))
    })
    .attr("stroke", "black")
    .style("stroke-width", 1)
    .append("title")
    .text(function (d, i) {
      return header[i] + ": " + Math.round(d.data.value * 100) / 100 + " (" + dataArray[0] + ")";
    });
}

function drawPlotBg(element) {
  // draw background of plot box (for bar and line charts)

  plotbg = element.append("g").attr("class", "plot plot-bg")
  plotbg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .style('fill', 'white');
  // axis lines
  plotbg.append("line")
    .attr("x1", 0)
    .attr("y1", height)
    .attr("x2", width)
    .attr("y2", height)
    .style('stroke', "black")
    .style('stroke-width', 1);
  plotbg.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", height)
    .style('stroke', "black")
    .style('stroke-width', 1);
  if (group) {
    var barWidth = (width) / Object.keys(group).length
    var space = 6 / (Object.keys(group).length - 1)
    plotbg.selectAll('whatever')
      .data(Object.keys(group))
      .enter().append("line")
      .attr("x1", function (d, i) {
        return i * barWidth + (space * i) / 2 + (barWidth / 2)
      })
      .attr("y1", height)
      .attr("x2", function (d, i) {
        return i * barWidth + (space * i) / 2 + (barWidth / 2)
      })
      .attr("y2", (height + 2))
      .style('stroke', "black")
      .style('stroke-width', 1);
  }
}

function drawCircleHeatmap(element, dataArray, header, colorScale) {
  // plot function for circle indicators

  var values = dataArray.slice(1, dataArray.length);

  if (header.length <= 7) {
    var barWidth = width / values.length;
  } else {
    var barWidth = width / Math.ceil(values.length / 2);
  }
  if (barWidth > height) {
    barWidth = height;
  }


  plot = element.selectAll("plot")
    .data(values);

  if (header.length <= 7) {
    heatmap = plot.enter().append("g").classed("plot", true)
      .attr("transform", function (d, i) {
        return "translate(" + ((i * barWidth)) + "," + 0 + ")";
      });
    heatmap.append("title")
      .text(function (d, i) {
        if (d === "") return header[i] + ": NA (" + dataArray[0] + ")";
        return header[i] + ": " + Math.round(d * 100) / 100 + " (" + dataArray[0] + ")";
      });
    heatmap.append("circle")
      .style('stroke', function (d) {
        if (d === "") return "none";
        // if (type == "met") return "white";
        return "black";
      })
      .style('stroke-width', '0.8')
      .attr("r", barWidth / 2)
      .attr("cx", (barWidth - 1) / 2)
      .attr("cy", (height) / 2)
      .style("fill", function (d) {
        if (d === "") return "none";
        return colorScale(d);
      });
  } else {
    var half_length = Math.ceil(values.length / 2);
    heatrows = plot.enter().append("g").classed("plot", true)
      .attr("transform", function (d, i) {
        if (i < half_length) {
          return "translate(" + ((i * barWidth)) + "," + 0 + ")";
        }
        return "translate(" + (((i - half_length) * barWidth)) + "," + (barWidth) + ")";
      });
    heatrows.append("title")
      .text(function (d, i) {
        if (d === "") return header[i] + ": NA (" + dataArray[0] + ")";
        return header[i] + ": " + Math.round(d * 100) / 100 + " (" + dataArray[0] + ")";
      });
    heatrows.append("circle")
      .style('stroke', function (d) {
        if (d === "") return "none";
        return "black";
      })
      .style('stroke-width', '0.8')
      .attr("r", barWidth / 2)
      .attr("cx", (barWidth - 1) / 2)
      .attr("cy", (height) / 4)
      .style("fill", function (d) {
        if (d === "") return "none";
        return colorScale(d);
      });
  }
}


function resetMap(type = "all") {
  // reset all plots
  d3.select("#legendSVG").selectAll("*").remove()
  $("#legendCard").hide()
  svg.selectAll(".plot-boxes").selectAll("*").remove()
  // }
}

function isEmpty(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key))
      return false;
  }
  return true;
}

function average(numbers) {
  // calculate the avarage of an array
  let sum = 0,
    len = numbers.length;
  if (!len) {
    return sum;
  }
  for (let i = 0; i < numbers.length; i++) {
    if (isNaN(parseFloat(numbers[i]))) {
      len -= 1
      continue
    }
    sum += parseFloat(numbers[i]);
  }
  return sum / len;
}