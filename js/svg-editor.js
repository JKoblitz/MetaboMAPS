
var width = 36.35,
    height = 16.5,
    scale = 1,
    nodes = {},
    lastType = "trans",
    svg, svgDoc, container,
    selected = [],
    lastNodeId = 4975

var lastAction = [];
var nextAction = [];
var maxActions = 10;



d3.json("data/identifiers.json").then(function (data) {
    nodes = data;
})


$("#undo").on("click", function () {
    // undo function
    if (lastAction.length == 0) return
    var undo = lastAction[lastAction.length - 1]
    var redo = { ...undo }
    switch (undo.type) {
        case "drag":
            redo.state = d3.select(undo.element).attr("transform")
            d3.select(undo.element).attr("transform", undo.state)
            break;
        case "add":
            d3.select(undo.element).remove()
            delete nodes[undo.id]
            break
        default:
            break;
    }
    nextAction.push(redo)
    lastAction.pop()
})


$("#redo").on("click", function () {
    // redo function
    if (nextAction.length == 0) return
    var redo = nextAction[nextAction.length - 1]
    var undo = { ...redo }
    switch (redo.type) {
        case "drag":
            undo.state = d3.select(redo.element).attr("transform")
            d3.select(redo.element).attr("transform", redo.state)
            break;
        case "add":

            break
        case "remove":
            d3.select(undo.element).remove()
            delete nodes[undo.id]
            break
        default:
            break;
    }
    lastAction.push(undo)
    nextAction.pop()
})

$(document).ready(function () {
    document.getElementById("maps-svg").addEventListener('load', function () {

        // drag and drop for plot boxes:
        var drag = d3.drag()
            .on("start", function () {
                // for undo and redo
                if (lastAction.length >= maxActions) {
                    lastAction.shift()
                }
                lastAction.push({
                    type: "drag",
                    element: this,
                    state: d3.select(this).attr("transform")
                })
            })
            .on("drag", function () {
                d3.select(this)
                    .attr('transform', 'translate(' + d3.event.x + ',' + d3.event.y + ') scale(' + scale + ')')
            });

        // selector for identifier form
        var form = d3.select("div#identifier-form")

        // SVG zoom
        zoom = d3.zoom()
            .scaleExtent([0.6, 6])
            .on("zoom", function () {
                d3.select(this).select("g.metabomaps-zoom").attr("transform", d3.event.transform);
            });

        // select SVG content, call zoom function and add style information:
        svgDoc = this.contentDocument
        if (!svgDoc || svgDoc === undefined) {
            d3.select("#content").append("p").text("file not found")
            return
        }
        svg = d3.select(svgDoc).select("svg")
            .call(zoom)
        svg.append("style").attr("id", "temp-style")
            .text(".metabomaps-zoom>:not(.metabomaps-plots){pointer-events:none} rect.pb {fill: #dddddd;stroke:#6d8300; stroke-width: 2} rect.selected {fill: #aaaaaa} rect.unassigned {stroke: #bf1d3d}")

        // edit existing svg
        var wrapper = svg.select("g.metabomaps-zoom");
        container = wrapper.select("g.metabomaps-plots")
        var plotboxes = container.selectAll("g.plot-boxes")
            .call(drag)
            .on("click", selectNode)
        if (plotboxes.nodes().length != 0) {
            var old_scale = plotboxes.attr("transform").match(/scale\((\d+(\.\d+)?)\)/);
            scale = parseFloat(old_scale !== null ? old_scale[1] : 1)
            if (scale === NaN) scale = 1;
            plotboxes.append("rect").classed("pb", true)
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", width)
                .attr("height", height)
                .classed("unassigned", false)
            waitForData(function () {
                plotboxes.each(function () {
                    var id = parseInt(this.id.replace("pb", ""))
                    if (nodes[id] === undefined) {
                        nodes[id] = {
                            identifier: {},
                            type: "trans",
                            other: {}
                        }
                        d3.select(this).select("rect")
                            .classed("unassigned", true)
                    } else if (nodes[id]["type"] == "met") {
                        d3.select(this).select("rect")
                            .style("stroke-dasharray", "3,3")
                    }
                    if (nodes[id]["identifier"].length == 0) {
                        d3.select(this).select("rect")
                            .classed("unassigned", true)
                    }
                });
            });
            // call resize function to bring content in the center of the SVG
            resizeSVG();
        }



        svg.on("contextmenu", function () {
            // add new plot box on right click
            d3.event.preventDefault();
            nodes[++lastNodeId] = {
                identifier: {},
                type: lastType,
                other: {}
            }
            var plotbox = container.append("g")
                .classed("plot-boxes", true)
                .attr("id", "pb" + lastNodeId)
            const point = d3.mouse(plotbox.node());
            plotbox
                .attr('transform', 'translate(' + point[0] + ',' + point[1] + ') scale(' + scale + ')')
                .on("click", selectNode)
                .call(drag)
            plotbox.append("rect").classed("pb", true)
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", width)
                .attr("height", height)
                .classed("unassigned", true)
                .style("stroke-dasharray", (lastType == "met" ? "3,3" : null))
            // trigger click:
            plotbox.dispatch('click');
            if (lastAction.length >= maxActions) {
                lastAction.shift()
            }
            lastAction.push({
                type: "add",
                element: plotbox.node(),
                id: lastNodeId
            })
        })

        // assign the buttons for scaling plot boxes
        $("#box-size-plus,#box-size-minus").on("click", function () {
            var old_scale = scale
            if (this.value == "plus") {
                scale += .1
            } else {
                scale -= .1
            }
            if (scale <= .1 && this.value == "minus") return
            container.selectAll(".plot-boxes").each(
                function () {
                    var t = d3.select(this).attr('transform');
                    d3.select(this)
                        .attr('transform', t.replace("scale(" + old_scale + ")", 'scale(' + scale + ')'))
                })
        })

        // resize the SVG to prevent cropping
        function resizeSVG() {
            var m = 10;
            var bbox = wrapper.node().getBBox()
            svg.attr("width", bbox.width)
                .attr("height", bbox.height)
                .attr("viewBox", (bbox.x - m) + " " + (bbox.y - m) + " " + (bbox.width + 2 * m) + " " + (bbox.height + 2 * m))
        }


        // clear identifier input when the plot type is changed
        $("input[name=plotType]").on("change", function () {
            amsifyIdentifier.settings.suggestions = suggestions[this.value]
            $("#identifiers").val("")
            amsifyIdentifier.clear();
        })

        // assign functions to identifier change
        amsifyIdentifier._settings({
            afterAdd: updateIdentifiers,
            afterRemove: updateIdentifiers,
        })

        // define function to select a node
        function selectNode() {
            var g = d3.select(this)
            var id = parseInt(this.id.replace("pb", ""))
            var rect = g.select("rect")
            if (nodes[id] === undefined) {
                // back up if database was empty
                nodes[id] = {
                    identifier: {},
                    type: lastType,
                    other: {}
                }
                rect.classed("unassigned", true)
            }

            // on ctrl: multi-selection
            if (!d3.event.ctrlKey) {
                container.selectAll("rect.selected").classed("selected", false)
                if (!selected.includes(id)) {
                    selected = [id]
                    rect.classed("selected", true)
                } else {
                    selected = []
                }
            }
            else if (selected.includes(id)) {
                rect.classed("selected", false)
                selected = selected.filter(function (d) {
                    return d != id;
                });
            } else {
                selected.push(id)
                rect.classed("selected", true)
            }

            if (selected.length == 1) {
                // show identifier form if exactly one node is selected
                d3.select("#multi-select").style('display', "none")
                form.style('display', "block")
                amsifyIdentifier.settings.suggestions = suggestions[nodes[id]["type"]]
                if (nodes[id]["type"] == "met") {
                    amsifyIdentifier.settings.plotType = "met"
                    $("#plotType_met").prop("checked", true);
                } else {
                    amsifyIdentifier.settings.plotType = "trans"
                    $("#plotType_trans").prop("checked", true);
                }
                $("#identifiers").val("")
                amsifyIdentifier.clear();
                if (nodes[id]["identifier"].length) {
                    nodes[id]["identifier"].forEach(d => {
                        var tag = typeof d == "object" ? d.value + ":" + d.tag : d
                        var putative = parseFloat(d.putative) ? true : false;
                        amsifyIdentifier.addTag(tag, d.org == "0" ? "" : "bg-warning", false, putative)
                    });
                }

                // assign a function to remove current plot box
                d3.select("#remove-box").on("click", function () {
                    if (lastAction.length >= maxActions) {
                        lastAction.shift()
                    }
                    lastAction.push({
                        type: "remove",
                        element: g.node(),
                        data: nodes[id],
                        id: id
                    })
                    g.remove()
                    delete nodes[id]
                    form.style('display', "none")
                })
            } else if (selected.length > 1) {
                // multi-selection
                d3.select("#multi-select").style('display', "block")
                form.style('display', "none")
            } else {
                // nothing selected
                d3.select("#multi-select").style('display', "none")
                form.style('display', "none")
            }
        }


        function updateIdentifiers() {
            // update identifiers when the input is changed
            var rect = container.select("rect.selected")
            var g = d3.select(rect.node().parentNode);
            var id = parseInt(g.node().id.replace("pb", ""))
            nodes[id]["type"] = $('input[name=plotType]:checked').val();
            lastType = nodes[id]["type"]

            if (nodes[id]["type"] == "met") {
                rect.style("stroke-dasharray", "3,3")
                g.classed("met", true)
            } else {
                rect.style("stroke-dasharray", null)
                g.classed("met", false)
            }
            var identifiers = []
            var ec = /^\d\.\d+\.\d+\.\d+$/
            d3.select(".amsify-suggestags-input-area").selectAll("span.amsify-select-tag").each(function () {
                var el = d3.select(this)
                var ident = { value: el.attr("data-val"), tag: this.innerHTML.split("<")[0].trim(), putative: this.className.includes("putative") ? 1 : 0 }
                ident["org"] = (ident.tag != ident.value || ec.test(ident.value)) ? 0 : 9;
                identifiers.push(ident)
            })
            nodes[id]["identifier"] = identifiers
            rect.classed("unassigned", false)
            if (!nodes[id]["identifier"].length) {
                rect.classed("unassigned", true)
            }
        }


        svg.on("keydown", function () {
            // ctrl + A to select everything
            if (d3.event.keyCode == 65 && d3.event.ctrlKey) {
                selected = []
                container.selectAll("g.plot-boxes").each(function () {
                    var id = parseInt(this.id.replace("pb", ""))
                    selected.push(id)
                }).selectAll("rect").classed("selected", true)
                d3.select("#multi-select").style('display', "block")
                form.style('display', "none")
                return
            }
            if (d3.event.ctrlKey) return
            // move selection by arrow keys
            var direction = {
                38: [0, -5], // top
                40: [0, 5], // bottom
                37: [-5, 0], // left
                39: [5, 0] // right
            }
            if (d3.event.keyCode in direction) {
                var selection = container.selectAll("#pb" + selected.join(",#pb"))
                selection.attr("transform", function () {
                    var attr = d3.select(this).attr("transform")
                    var pos = attr.substring(attr.indexOf("(") + 1, attr.indexOf(")")).split(",");
                    return attr.replace(pos[0], parseFloat(pos[0]) + direction[d3.event.keyCode][0]).replace(pos[1], parseFloat(pos[1]) + direction[d3.event.keyCode][1])
                })
            }
        })

        // align plot boxes in multi-selection:
        $("#align-left").on("click", function () {
            alignSelection("l")
        })
        $("#align-right").on("click", function () {
            alignSelection("r")
        })
        $("#align-top").on("click", function () {
            alignSelection("t")
        })
        $("#align-bottom").on("click", function () {
            alignSelection("b")
        })

        function alignSelection(dir) {
            if (selected.length <= 1) return
            var selection = container.selectAll("#pb" + selected.join(",#pb"))
            var value
            selection.each(function () {
                var position = d3.select(this).attr("transform")
                position = position.substring(position.indexOf("(") + 1, position.indexOf(")")).split(",");
                if (dir == "l" || dir == "r") {
                    var x = parseFloat(position[0])
                } else if (dir == "t" || dir == "b") {
                    var x = parseFloat(position[1])
                }
                if (dir == "l" || dir == "t") {
                    if (x < value || value === undefined) {
                        value = x
                    }
                } else if (dir == "b" || dir == "r") {
                    if (x > value || value === undefined) {
                        value = x
                    }
                }
            })
            selection.attr("transform", function () {
                var attr = d3.select(this).attr("transform")
                var pos = attr.substring(attr.indexOf("(") + 1, attr.indexOf(")")).split(",");
                if (dir == "l" || dir == "r") {
                    return attr.replace(pos[0], value)
                } else if (dir == "t" || dir == "b") {
                    return attr.replace(pos[1], value)
                }
            })
        }
    })

    var waitForData = function (callback, iterator = 1) {
        // wait until nodes data are loaded
        if (Object.keys(nodes).length > 0) {
            callback();
        } else {
            if (iterator < 100) {
                setTimeout(function () {
                    waitForData(callback, ++iterator);
                }, 100);
            }
        }
    };

    // trigger load event
    $("#maps-svg").attr("data", $("#maps-svg").attr("data") + "?dummy=" + Math.floor(Math.random() * (+1000000 - +1)) + +1)

})

