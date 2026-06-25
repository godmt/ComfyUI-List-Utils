import { app } from "../../scripts/app.js"
import { ComfyWidgets } from "../../scripts/widgets.js"


// ref: https://gist.github.com/Amorano/9871fb3be1aa75defdfad013e1f95e0e
const _prefix = 'value'

const TypeSlot = {
    Input: 1,
    Output: 2,
}

const TypeSlotEvent = {
    Connect: true,
    Disconnect: false,
}

const TOOLTIP_VALUE_INPUT = "Connect a value. Connecting the last empty socket adds another input."
const TOOLTIP_PACK_VALUE_INPUT = "Value to store in the PACK. The input name, type, and value are preserved for Unpack."
const TOOLTIP_PYLIST_INPUT = "Connect a PyList. Connecting the last empty socket adds another input."
const TOOLTIP_EXEC_INPUT = "Input value available inside FUNC as x[index]. Connecting the last empty socket adds another input."
const TOOLTIP_UNPACK_OUTPUT = "Value restored from the connected PACK. Output type is copied from the original Pack input."

const setTooltip = (slot, tooltip) => {
    if (slot && tooltip) {
        slot.tooltip = tooltip
    }
    return slot
}

const addInputWithTooltip = (node, name, type, tooltip) => {
    const index = node.inputs?.length ?? 0
    node.addInput(name, type)
    return setTooltip(node.inputs?.[index], tooltip)
}

const addOutputWithTooltip = (node, name, type, tooltip) => {
    const index = node.outputs?.length ?? 0
    node.addOutput(name, type)
    return setTooltip(node.outputs?.[index], tooltip)
}

const findNodeById = (graph, id) => {
    return graph?.getNodeById?.(id)
        ?? graph?._nodes?.find((node) => node.id == id)
}

const normalizeLink = (link) => {
    if (!Array.isArray(link)) {
        return link
    }
    return {
        id: link[0],
        origin_id: link[1],
        origin_slot: link[2],
        target_id: link[3],
        target_slot: link[4],
        type: link[5],
    }
}

const findLinkById = (graph, id) => {
    if (id === undefined || id === null) {
        return undefined
    }
    const links = graph?.links ?? graph?._links
    const direct = links?.get?.(id)
        ?? links?.get?.(String(id))
        ?? links?.[id]
        ?? links?.[String(id)]
    if (direct) {
        return normalizeLink(direct)
    }
    if (Array.isArray(links)) {
        return normalizeLink(links.find((link) => {
            const normalized = normalizeLink(link)
            return normalized?.id == id
        }))
    }
}

const getOriginType = (node, linkInfo, app) => {
    if (!linkInfo) {
        return undefined
    }

    // Subgraph nodes must resolve links against their own graph. During graph
    // configuration the origin node may not exist yet, so keep the serialized
    // link type as a safe fallback.
    const originNode = findNodeById(node?.graph, linkInfo.origin_id)
        ?? findNodeById(app?.graph, linkInfo.origin_id)
    return originNode?.outputs?.[linkInfo.origin_slot]?.type
        ?? linkInfo.type
}

const findPackOrigin = (node, linkInfo, app) => {
    if (!linkInfo) {
        return undefined
    }

    let graph = node?.graph ?? app?.graph
    let originId = linkInfo.origin_id
    for (let depth = 0; depth < 20; depth++) {
        let originNode = findNodeById(graph, originId)
        if (!originNode && graph !== app?.graph) {
            graph = app?.graph
            originNode = findNodeById(graph, originId)
        }
        if (!originNode) {
            return undefined
        }
        if (originNode.type === "GODMT_Pack") {
            return originNode
        }

        const originInput = originNode.inputs?.find((input) => input.type === "PACK")
            ?? originNode.inputs?.find((input) => input.type === "*")
        const upstreamLink = findLinkById(graph, originInput?.link)
        if (!upstreamLink) {
            return undefined
        }
        originId = upstreamLink.origin_id
    }
}

const dynamic_connection = (
    node,
    index,
    event,
    prefix = 'in_',
    type = '*',
    names = [],
    tooltip = ""
) => {
    const input = node.inputs?.[index]
    if (!input?.name?.startsWith(prefix)) {
        return false
    }
    let removed = false
    // remove all non connected inputs
    if (event == TypeSlotEvent.Disconnect && node.inputs.length > 1) {
        if (node.widgets) {
            const widget = node.widgets.find((w) => w.name === node.inputs[index].name)
            if (widget) {
                widget.onRemoved?.()
                node.widgets.length = node.widgets.length - 1
            }
        }
        node.removeInput(index)
        removed = true

        // TODO type
        // make inputs sequential again
        for (let i = 0; i < node.inputs.length; i++) {
            const name = i < names.length ? names[i] : `${prefix}${i + 1}`
            node.inputs[i].label = name
            node.inputs[i].name = name
            setTooltip(node.inputs[i], tooltip)
        }
    }

    // add an extra input
    if (node.inputs?.length && node.inputs[node.inputs.length - 1].link != undefined) {
        const nextIndex = node.inputs.length
        const name = nextIndex < names.length
            ? names[nextIndex]
            : `${prefix}${nextIndex + 1}`
        addInputWithTooltip(node, name, type, tooltip)
    }
    return removed
}

/**
 * Get all unique types in the workflow.
 * @returns {Set} Unique set of all types used in the workflow
 */
function getWorkflowTypes(app, currentNode) {
    const types = new Set(["*", "STRING", "INT", "FLOAT", "BOOLEAN", "IMAGE", "LATENT", "MASK", "NOISE", "SAMPLER", "SIGMAS", "GUIDER", "MODEL", "CLIP", "VAE", "CONDITIONING"])
    const graphs = new Set([app?.graph, currentNode?.graph])
    graphs.forEach((graph) => {
        graph?._nodes?.forEach(node => {
            node.inputs?.forEach(slot => {
                if (slot?.type) {
                    types.add(slot.type)
                }
            })
            node.outputs?.forEach(slot => {
                if (slot?.type) {
                    types.add(slot.type)
                }
            })
        })
    })
    return Array.from(types)
}


function renderTable(data, container) {
    container.innerHTML = ""  // Clear previous content
    const table = document.createElement("table")
    table.className = "comfy-table"

    // Add headers
    const headerRow = table.insertRow()
    headerRow.insertCell().textContent = "Index"
    headerRow.insertCell().textContent = "Value"

    // Populate rows
    data.forEach((item) => {
        const row = table.insertRow()
        row.insertCell().textContent = item.index
        row.insertCell().textContent = item.value
    });

    container.appendChild(table)
}


app.registerExtension({
    name: "godmt.ListUtils",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "GODMT_Pack" || nodeData.name === "GODMT_CreatePyList") {
            const inputTooltip = nodeData.name === "GODMT_Pack"
                ? TOOLTIP_PACK_VALUE_INPUT
                : TOOLTIP_VALUE_INPUT
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                addInputWithTooltip(this, `${_prefix}_1`, '*', inputTooltip)
                return r
            }

            // on copy and paste
            const onConfigure = nodeType.prototype.onConfigure
            nodeType.prototype.onConfigure = function () {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined
                if (!app.configuringGraph && this.inputs) {
                    const length = this.inputs.length
                    for (let i = length - 1; i >= 0; i--) {
                        this.removeInput(i)
                    }
                    addInputWithTooltip(this, `${_prefix}_1`, '*', inputTooltip)
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    const removed = dynamic_connection(this, slot, event, `${_prefix}_`, '*', [], inputTooltip)
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const type = getOriginType(this, link_info, app)
                        if (type !== undefined && this.inputs?.[slot]) {
                            this.inputs[slot].type = type
                            setTooltip(this.inputs[slot], inputTooltip)
                        }
                    } else if (event === TypeSlotEvent.Disconnect && !removed && this.inputs?.[slot]) {
                        this.inputs[slot].type = '*'
                        this.inputs[slot].label = `${_prefix}_${slot + 1}`
                        setTooltip(this.inputs[slot], inputTooltip)
                    }
                }
                return r
            }
        } else if (nodeData.name === "GODMT_Exec") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                addInputWithTooltip(this, `x[0]`, '*', TOOLTIP_EXEC_INPUT)
                return r
            }

            // on copy and paste
            const onConfigure = nodeType.prototype.onConfigure
            nodeType.prototype.onConfigure = function () {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined
                if (!app.configuringGraph && this.inputs) {
                    const length = this.inputs.length
                    for (let i = length - 1; i > 0; i--) {
                        this.removeInput(i)
                    }
                    addInputWithTooltip(this, `x[0]`, '*', TOOLTIP_EXEC_INPUT)
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    // remove all disconnected inputs
                    if (event == TypeSlotEvent.Disconnect && this.inputs?.[slot] && this.inputs.length > 1) {
                        if (this.widgets) {
                            const widget = this.widgets.find((w) => w.name === this.inputs[slot].name)
                            if (widget) {
                                widget.onRemoved?.()
                                this.widgets.length = this.widgets.length - 1
                            }
                        }
                        this.removeInput(slot)
                        // make inputs sequential again (0 is string widget)
                        for (let i = 1; i < this.inputs.length; i++) {
                            const name = `x[${i-1}]`
                            this.inputs[i].label = name
                            this.inputs[i].name = name
                            setTooltip(this.inputs[i], TOOLTIP_EXEC_INPUT)
                        }
                    }

                    // TODO type
                    const type = "*"
                    // add an extra input
                    if (this.inputs[this.inputs.length - 1].link != undefined) {
                        const nextIndex = this.inputs.length - 1  // string widget is regarded as input also
                        const name = `x[${nextIndex}]`
                        addInputWithTooltip(this, name, type, TOOLTIP_EXEC_INPUT)
                    }

                    if (event === TypeSlotEvent.Connect && link_info) {
                        const type = getOriginType(this, link_info, app)
                        if (type !== undefined && this.inputs?.[slot]) {
                            this.inputs[slot].type = type
                            setTooltip(this.inputs[slot], TOOLTIP_EXEC_INPUT)
                        }
                    } else if (event === TypeSlotEvent.Disconnect) {
                        // this.inputs[slot].type = '*'
                        // this.inputs[slot].label = `x[${slot}]`
                    }
                    if (this.widgets && this.widgets[0]) {
                        this.widgets[0].y = this.inputs.length * 20
                        // TODO update node height
                    }
                }
                return r
            }
        }
        else if (nodeData.name === "GODMT_CreateList" || nodeData.name === "GODMT_MergeList") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                addInputWithTooltip(this, `${_prefix}_1`, '*', TOOLTIP_VALUE_INPUT)
                return r
            }

            // TODO might be buggy on load
            // on copy, paste, load
            const onConfigure = nodeType.prototype.onConfigure
            nodeType.prototype.onConfigure = function () {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined
                if (!app.configuringGraph && this.inputs) {
                    const length = this.inputs.length
                    for (let i = length - 1; i >= 0; i--) {
                        this.removeInput(i)
                    }
                    addInputWithTooltip(this, `${_prefix}_1`, '*', TOOLTIP_VALUE_INPUT)
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    if (!this.inputs?.[slot]?.name?.startsWith(_prefix)) {
                        return
                    }

                    if (event == TypeSlotEvent.Connect && link_info) {
                        if (slot == 0) {
                            const origin_type = getOriginType(this, link_info, app)
                            if (origin_type !== undefined) {
                                this.inputs[0].type = origin_type
                                this.outputs[0].type = origin_type
                                this.outputs[0].label = origin_type
                                this.outputs[0].name = origin_type
                            }
                        }
                    }

                    // remove all non connected inputs
                    if (event == TypeSlotEvent.Disconnect && this.inputs.length > 0) {
                        if (this.widgets) {
                            const widget = this.widgets.find((w) => w.name === this.inputs[slot].name)
                            if (widget) {
                                widget.onRemoved?.()
                                this.widgets.length = this.widgets.length - 1
                            }
                        }
                        this.removeInput(slot)
                        if (this.inputs.length === 0) {
                            addInputWithTooltip(this, `${_prefix}_1`, '*', TOOLTIP_VALUE_INPUT)
                        }
                        // make inputs sequential again
                        for (let i = 0; i < this.inputs.length; i++) {
                            this.inputs[i].label = `${_prefix}_${i + 1}`
                            this.inputs[i].name = `${_prefix}_${i + 1}`
                            setTooltip(this.inputs[i], TOOLTIP_VALUE_INPUT)
                        }
                        const firstLink = findLinkById(this.graph, this.inputs[0]?.link)
                        const firstType = getOriginType(this, firstLink, app) ?? "*"
                        if (this.inputs[0]) {
                            this.inputs[0].type = firstType
                        }
                        if (this.outputs?.[0]) {
                            this.outputs[0].type = firstType
                            this.outputs[0].label = firstType
                            this.outputs[0].name = firstType
                        }
                    }

                    // add an extra input
                    if (this.inputs?.length && this.inputs[this.inputs.length - 1].link != undefined) {
                        const nextIndex = this.inputs.length
                        addInputWithTooltip(this, `${_prefix}_${nextIndex + 1}`, this.inputs[0].type, TOOLTIP_VALUE_INPUT)
                    }
                }
                return r
            }
        } else if (nodeData.name == "GODMT_MergePyList") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                addInputWithTooltip(this, `${_prefix}_1`, 'PYLIST', TOOLTIP_PYLIST_INPUT)
                return r
            }

            // on copy and paste
            const onConfigure = nodeType.prototype.onConfigure
            nodeType.prototype.onConfigure = function () {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined
                if (!app.configuringGraph && this.inputs) {
                    const length = this.inputs.length
                    for (let i = length - 1; i >= 0; i--) {
                        this.removeInput(i)
                    }
                    addInputWithTooltip(this, `${_prefix}_1`, 'PYLIST', TOOLTIP_PYLIST_INPUT)
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    const removed = dynamic_connection(this, slot, event, `${_prefix}_`, 'PYLIST', [], TOOLTIP_PYLIST_INPUT)
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const type = getOriginType(this, link_info, app)
                        if (type !== undefined && this.inputs?.[slot]) {
                            this.inputs[slot].type = type
                            setTooltip(this.inputs[slot], TOOLTIP_PYLIST_INPUT)
                        }
                    } else if (event === TypeSlotEvent.Disconnect && !removed && this.inputs?.[slot]) {
                        this.inputs[slot].type = 'PYLIST'
                        this.inputs[slot].label = `${_prefix}_${slot + 1}`
                        setTooltip(this.inputs[slot], TOOLTIP_PYLIST_INPUT)
                    }
                }
                return r
            }
        } else if (nodeData.name === "GODMT_Unpack") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                // shrink outputs to 1
                if (!this.outputs?.length) {
                    addOutputWithTooltip(this, `${_prefix}_1`, "*", TOOLTIP_UNPACK_OUTPUT)
                }
                this.outputs[0].type = "*"
                setTooltip(this.outputs[0], TOOLTIP_UNPACK_OUTPUT)
                const output_len = this.outputs?.length ?? 0
                for (let i = output_len - 1; i > 0; i--) {
                    this.removeOutput(i)
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const origin_node = findPackOrigin(this, link_info, app)
                        if (origin_node) {
                            const origin_inputs = origin_node.inputs ?? []
                            const output_len = Math.max(origin_inputs.length - 1, 1)  // end is empty socket
                            const cur_len = this.outputs?.length ?? 0
                            for (let i = cur_len - 1; i >= output_len; i--) {
                                this.removeOutput(i)
                            }
                            for (let i = cur_len; i < output_len; i++) {
                                const originInput = origin_inputs[i]
                                addOutputWithTooltip(
                                    this,
                                    originInput?.name ?? `${_prefix}_${i + 1}`,
                                    originInput?.type ?? "*",
                                    TOOLTIP_UNPACK_OUTPUT
                                )
                            }
                            for (let i = 0; i < cur_len && i < output_len; i++) {
                                const originInput = origin_inputs[i]
                                this.outputs[i].type = originInput?.type ?? "*"
                                this.outputs[i].label = originInput?.name ?? `${_prefix}_${i + 1}`
                                this.outputs[i].name = originInput?.name ?? `${_prefix}_${i + 1}`
                                setTooltip(this.outputs[i], TOOLTIP_UNPACK_OUTPUT)
                            }
                        }
                    } else if (event === TypeSlotEvent.Disconnect) {
                        const output_len = this.outputs?.length ?? 0
                        for (let i = output_len - 1; i > 0; i--) {
                            this.removeOutput(i)
                        }
                        if (this.outputs?.[0]) {
                            this.outputs[0].type = "*"
                            this.outputs[0].label = "*"
                            this.outputs[0].name = "*"
                            setTooltip(this.outputs[0], TOOLTIP_UNPACK_OUTPUT)
                        }
                    }
                }
                return r
            }
        } else if (nodeData.name == "GODMT_AnyCast") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                if (!this.widgets?.[0] || !this.outputs?.[0]) {
                    return r
                }
                const onWidgetChanged = this.widgets[0].callback
                const thisNode = this
                this.widgets[0].options.values = getWorkflowTypes(app, this)
                const output_type = thisNode.widgets[0].value
                thisNode.outputs[0].type = output_type
                thisNode.outputs[0].label = output_type
                thisNode.outputs[0].name = output_type
                this.widgets[0].callback = function () {
                    const me = onWidgetChanged ? onWidgetChanged.apply(this, arguments) : undefined
                    thisNode.widgets[0].options.values = getWorkflowTypes(app, thisNode)
                    const output_type = thisNode.widgets[0].value
                    thisNode.outputs[0].type = output_type
                    thisNode.outputs[0].label = output_type
                    thisNode.outputs[0].name = output_type
                    return me
                }
                return r
            }
            // on copy, paste, load
            const onConfigure = nodeType.prototype.onConfigure
            nodeType.prototype.onConfigure = function () {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined
                if (!this.widgets?.[0] || !this.outputs?.[0]) {
                    return r
                }
                this.widgets[0].options.values = getWorkflowTypes(app, this)
                const output_type = this.widgets[0].value
                this.outputs[0].type = output_type
                this.outputs[0].label = output_type
                this.outputs[0].name = output_type
                return r
            }
            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    if (!this.widgets?.[0] || !this.outputs?.[0]) {
                        return r
                    }
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const origin_type = getOriginType(this, link_info, app)
                        this.widgets[0].options.values = getWorkflowTypes(app, this)
                        const output_type = this.widgets[0].value
                        this.outputs[0].type = output_type
                        this.outputs[0].label = output_type
                        this.outputs[0].name = origin_type ?? "*"
                    } else if (event === TypeSlotEvent.Disconnect) {
                        this.outputs[0].type = "*"
                        this.outputs[0].label = "*"
                        this.outputs[0].name = "*"
                    }
                }
                return r
            }
        } else if (nodeData.name === "GODMT_GetWidgetsValues") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined
                this.showValueWidget = ComfyWidgets["STRING"](this, "values", ["STRING", { multiline: true }], app).widget
            }
            const onExecuted = nodeType.prototype.onExecuted
            nodeType.prototype.onExecuted = function (message) {
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message])
                this.showValueWidget.value = message.text[0]
            }
        } else if (nodeData.name === "GODMT_GetLength") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined
                this.showValueWidget = ComfyWidgets["STRING"](this, "length", ["STRING", { multiline: false }], app).widget
                // this.addWidget("STRING", "length", "", () => { }, { multiline: false })
            }
            const onExecuted = nodeType.prototype.onExecuted
            nodeType.prototype.onExecuted = function (message) {
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message])
                this.showValueWidget.value = message.text[0]
            }
        } else if (nodeData.name === "GODMT_GetShape") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined
                this.showValueWidget = ComfyWidgets["STRING"](this, "WHBC", ["STRING", { multiline: false }], app).widget
            }
            const onExecuted = nodeType.prototype.onExecuted
            nodeType.prototype.onExecuted = function (message) {
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message])
                this.showValueWidget.value = message.text[0]
            }
        } else if (nodeData.name === "GODMT_ListGetByIndex" || nodeData.name === "GODMT_ListSlice") {
            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const origin_type = getOriginType(this, link_info, app)
                        if (origin_type !== undefined) {
                            this.outputs[0].type = origin_type
                            this.outputs[0].label = origin_type
                            this.outputs[0].name = origin_type
                        }
                    } else if (event === TypeSlotEvent.Disconnect) {
                        this.outputs[0].type = "*"
                        this.outputs[0].label = "*"
                        this.outputs[0].name = "*"
                    }
                }
                return r
            }
        } else if (nodeData.name === "GODMT_DisplayList") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeData.input.required.input_list[1].widget = "LIST_TABLE";
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined
                // this.showValueWidget = ListTableWidget(this, "list_table", ["STRING", {}], app).widget
                this.showValueWidget = ComfyWidgets["STRING"](this, "list_table", ["STRING", { multiline: true }], app).widget
            }
            const onExecuted = nodeType.prototype.onExecuted
            nodeType.prototype.onExecuted = function (message) {
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message])
                try {
                    const data = JSON.parse(message.text[0])
                    console.log(data)
                    let text = ""
                    data.forEach(d => {
                        text += d.index + " : " + d.value + "\n"
                    })
                    this.showValueWidget.value = text
                } catch (e) {
                    console.error("Error parsing list data:", e)
                }
            }
        }
    }
})
