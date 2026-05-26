# ComfyUI-Animadex-Node

这是一个为 [ComfyUI](https://github.com/comfyanonymous/ComfyUI) 编写的自定义节点，提供对 [Animadex](https://animadex.net/) 网站上 36000+ 个角色的直接支持。

## 功能介绍

该节点可以让你在 ComfyUI 工作流中直接通过下拉菜单搜索并选择 Animadex 上收录的热门角色，节点会自动输出：
1. **IMAGE**: 该角色的参考图片（动态加载并自动转换为 ComfyUI 可用的格式，可用于 IPAdapter 或 ControlNet 参考图）。
2. **TRIGGER_WORDS**: 角色的专有触发词（用于连接 CLIP Text Encode）。
3. **PROMPT_TAGS**: 与该角色相匹配的高质量 Prompt 特征提示词（用于连接 CLIP Text Encode，丰富画面细节）。

## 节点选项

* **character**: 提供了超过 3.6 万个动漫角色的下拉菜单，支持输入搜索。
* **use_high_res_image**: 选择是否使用高清原始大图。选 `true` 将获取高清原图（下载较慢），选 `false` 将获取缩略图（下载快，推荐作为轻量级参考图）。

## 安装方法

1. 进入你的 ComfyUI 的 `custom_nodes` 文件夹：
```bash
cd ComfyUI/custom_nodes/
```
2. 克隆本仓库：
```bash
git clone https://github.com/wrt122311/ComfyUI-Animadex-Node.git
```
3. 重新启动 ComfyUI。
4. 在 ComfyUI 空白处右键，选择 `Add Node` -> `Animadex` -> `Animadex Character Selector`。

## 数据来源

本节点内置的角色数据（`animadex_top_characters.json`）全部来自于 [Animadex 官网](https://animadex.net/)。如果想要更新数据，可以利用爬虫脚本重新拉取。

## 许可证 (License)

MIT
