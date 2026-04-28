import { Plugin, showMessage, getAllEditor, IMenu } from "siyuan";

export default class PluginSample extends Plugin {
    private my_title_menu_item(blockId?: string) {
        const mt: IMenu = {
            type: "submenu",
            label: "MY-标题操作",
            icon: "iconHeadings",
            submenu: [
                {
                    label: "MY-标题升级",
                    icon: "iconUpload",
                    click: () => {
                        upGrade(blockId, 1);
                    },
                },
                {
                    label: "MY-标题降级",
                    icon: "iconDownload",
                    click: () => {
                        downGrade(blockId, 1);
                    },
                },
                {
                    label: "MY-标题添加序号",
                    click: () => {
                        getParentDocID(blockId).then((docID) => {
                            SYgetChildBlocks(docID).then((d) => {
                                const data = d.data;
                                delete_title_index(data).then(() => {
                                    add_title_index(data);
                                });
                            });
                        });
                    },
                },
                {
                    label: "MY-标题去除序号",
                    click: () => {
                        getParentDocID(blockId).then((docID) => {
                            SYgetChildBlocks(docID).then((d) => {
                                const data = d.data;
                                delete_title_index(data);
                            });
                        });
                    },
                },
            ],
        };
        return mt;
    }
    private my_delete_after_blocks_menu_item(blockId: string) {
        return {
            label: "MY-删除后子块",
            icon: "iconTrashcan",
            click: () => {
                if (confirm("确定删除？")) {
                    delete_block_after(blockId);
                    showMessage("✅ 删除成功");
                }
            },
        };
    }
    private my_remove_bold_menu_item(blockIds: string[]) {
        return {
            label: "MY-去除加粗",
            icon: "iconBold",
            click: () => {
                if (!blockIds) {
                    showMessage("无法获取块 ID");
                    return;
                }
                for (const bid of blockIds) {
                    SYgetBlockKramdown(bid)
                        .then((d) => {
                            const lines = d.data.kramdown.split("\n");
                            const txt_md = lines.slice(0, -1).join("\n");
                            let new_md = txt_md.replace(/\*\*/g, "");
                            SYupdateBlock(new_md, bid);
                        })
                        .then(() => {
                            showMessage(bid + " 已去除加粗");
                        })
                        .catch((err) => {
                            showMessage("操作失败: " + err.message);
                        });
                }
            },
        };
    }
    // 插件开启时执行
    async onload() {
        console.log("✅ 我的插件加载完成");
    }

    // 思源界面加载完毕后执行
    // 【所有右键菜单、按钮 都写在这里】
    onLayoutReady() {
        // ==========  正文内容 右键菜单 ==========
        this.eventBus.on("open-menu-content", (opts) => {
            const blockElement = opts.detail.element;
            const blockId = blockElement?.dataset.nodeId;
            opts.detail.menu.addItem(this.my_remove_bold_menu_item([blockId]));
            opts.detail.menu.addItem(this.my_delete_after_blocks_menu_item(blockId));
            opts.detail.menu.addItem(this.my_title_menu_item(blockId));
        });
        // ==========  块 右键菜单 ==========
        this.eventBus.on("click-blockicon", (opts) => {
            const blockElements = opts.detail.blockElements;
            if (blockElements.length === 1) {
                const blockId = blockElements[0].dataset.nodeId;
                opts.detail.menu.addItem(this.my_remove_bold_menu_item([blockId]));
                opts.detail.menu.addItem(this.my_delete_after_blocks_menu_item(blockId));
                opts.detail.menu.addItem(this.my_title_menu_item(blockId));
            } else {
                const blockIDs = blockElements.map((b) => b.dataset.nodeId);
                opts.detail.menu.addItem(this.my_remove_bold_menu_item(blockIDs));
            }
        });
    }

    // 插件关闭时执行
    async onunload() {
        console.log("❌ 插件已关闭");
    }

    // 插件卸载时执行
    uninstall() {}

    // 工具：获取当前打开的编辑器
    getEditor() {
        const editors = getAllEditor();
        if (editors.length === 0) {
            showMessage("请先打开一篇文档");
            return null;
        }
        return editors[0];
    }
}
// 1. 获取块的父块 ID
async function getParentBlock(block_id: string) {
    const result = await SYsql_query(`SELECT parent_id FROM blocks WHERE id = '${block_id}'`);
    if (result["code"] == 0 && result["data"]) {
        return result["data"][0].parent_id;
    }
    return null;
}

// 2. 循环向上找，直到拿到【子文档 ID】
async function getParentDocID(block_id: string) {
    let s = await getParentBlock(block_id);
    while (s) {
        const pre = s;
        s = await getParentBlock(pre);
        if (!s) {
            return pre;
        }
    }
    return null;
}

// 3. 删除目标块【后面所有同级块】
async function delete_block_after(target_block_id: string) {
    // 获取笔记本 ID
    const parent_id = await getParentDocID(target_block_id);
    if (!parent_id) return;

    // 获取所有子块
    const d = await SYgetChildBlocks(parent_id);
    let children = d.data;
    const block_ids = children.map((b) => b.id);

    // 删除目标块及后面所有块
    const idx = block_ids.indexOf(target_block_id);
    if (idx !== -1) {
        const to_del = block_ids.slice(idx);
        for (const bid of to_del) {
            await SYdeleteBlock(bid);
        }
    }
}

// 标题级别映射
const mappingDown: Record<string, string> = {
    h1: "h2",
    h2: "h3",
    h3: "h4",
    h4: "h5",
    h5: "h6",
};

const mappingUp: Record<string, string> = {
    h2: "h1",
    h3: "h2",
    h4: "h3",
    h5: "h4",
    h6: "h5",
};

// 标题降级（h1 → h2 → h3...）
async function downGrade(docId: string, count: number) {
    docId = await getParentDocID(docId);
    while (count > 0) {
        count--;
        const result = await SYgetChildBlocks(docId);

        for (const block of result.data) {
            const subType = block.subType ?? "";
            const blockId = block.id ?? "";
            const markdown = block.markdown ?? "";

            if (subType in mappingDown) {
                const newMarkdown = "#" + markdown;
                await SYupdateBlock(newMarkdown, blockId);
            }
        }
    }
}

// 标题升级（h6 → h5 → h4...）
async function upGrade(docId: string, count: number) {
    docId = await getParentDocID(docId);
    while (count > 0) {
        count--;
        const result = await SYgetChildBlocks(docId);

        for (const block of result.data) {
            const subType = block.subType ?? "";
            const blockId = block.id ?? "";
            const markdown = block.markdown ?? "";

            if (subType in mappingUp) {
                const newMarkdown = markdown.startsWith("#") ? markdown.slice(1) : markdown;
                await SYupdateBlock(newMarkdown, blockId);
            }
        }
    }
}

// 完全复刻原版 Python 变量
let count = {
    h2: 0,
    h3: 0,
    h4: 0,
    h5: 0,
    h6: 0,
};

function generate_title_markdown(grade: number) {
    let md = "#".repeat(grade) + " ";
    for (let i = 2; i <= grade; i++) {
        md += count["h" + i.toString()];
        if (i != grade) {
            md += ".";
        } else {
            if (grade == 2) {
                md += ". ";
            } else {
                md += " ";
            }
        }
    }
    return md;
}

async function delete_title_index(d: any[]) {
    for (let data of d) {
        let subType = data.subType ?? "";
        if (subType in count) {
            let md = data["markdown"];
            md = md.replace(/\d+(\.\d+)*\.?\s*/, "");
            await SYupdateBlock(md, data["id"]);
        }
    }
}

async function add_title_index(d: any[]) {
    count = { h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    for (let data of d) {
        let subType = data.subType ?? "";
        if (subType in count) {
            let grade = parseInt(subType.match(/\d/)![0]);
            count[subType] += 1;
            for (let i = grade + 1; i < 7; i++) {
                count["h" + i.toString()] = 0;
            }
            let md = data["markdown"];
            md = md.replace(/^#+ /, "");
            md = generate_title_markdown(grade) + md;
            await SYupdateBlock(md, data["id"]);
        }
    }
}
// 思源api
async function SYgetBlockKramdown(id: string) {
    const resp = await fetch("/api/block/getBlockKramdown", {
        method: "POST",
        body: JSON.stringify({
            id: id,
        }),
    });
    return await resp.json();
}

async function SYupdateBlock(new_md: string, blockId: string) {
    await fetch("/api/block/updateBlock", {
        method: "POST",
        body: JSON.stringify({ dataType: "markdown", data: new_md, id: blockId }),
    });
}

async function SYgetChildBlocks(id: string) {
    const resp = await fetch("/api/block/getChildBlocks", {
        method: "POST",
        body: JSON.stringify({
            id: id,
        }),
    });
    return await resp.json();
}

async function SYdeleteBlock(id: string) {
    await fetch("/api/block/deleteBlock", {
        method: "POST",
        body: JSON.stringify({
            id: id,
        }),
    });
}

async function SYsql_query(stmt: string) {
    const resp = await fetch("/api/query/sql", {
        method: "POST",
        body: JSON.stringify({
            stmt: stmt,
        }),
    });
    return await resp.json();
}
