import {
	type ExtensionAPI,
	type ExtensionCommandContext,
	estimateTokens,
	getMarkdownTheme,
} from "@earendil-works/pi-coding-agent";
import { Key, Markdown, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export type ContextPart = {
	label: string;
	tokens: number;
	color: "accent" | "success" | "warning" | "muted" | "dim";
};

type PreviewKey = "systemPrompt" | "tools" | "contextFiles" | "skills";

type ContextPreview = {
	key: PreviewKey;
	label: string;
	title: string;
	content: string;
};

function normalizePreviewText(text: string): string {
	return text
		.replace(/\r\n?/g, "\n")
		.replace(/\t/g, "  ")
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export type DialogBounds = { left: number; top: number; width: number };

/** 1-based terminal hitbox of the [esc] close button on the dialog title row (row 2 of the box). */
export function escCloseHitbox(bounds: DialogBounds): {
	row: number;
	startCol: number;
	endCol: number;
} {
	return {
		row: bounds.top + 2,
		startCol: bounds.left + bounds.width - 5,
		endCol: bounds.left + bounds.width - 1,
	};
}

export async function showTextPreview(
	ctx: Pick<ExtensionCommandContext, "ui">,
	title: string,
	rawContent: string,
): Promise<void> {
	const content = normalizePreviewText(rawContent);
	await ctx.ui.custom(
		(tui, theme, _keybindings, done) => {
			let scrollOffset = 0;
			let pageSize = 1;
			let totalLines = 1;
			let escHitbox: { row: number; startCol: number; endCol: number } | undefined;
			const markdownView = new Markdown(content, 0, 0, getMarkdownTheme());

			const scrollTo = (nextOffset: number): void => {
				scrollOffset = Math.max(0, Math.min(nextOffset, Math.max(0, totalLines - pageSize)));
				tui.requestRender();
			};

			return {
				invalidate() {
					markdownView.invalidate();
				},
				handleInput(data: string) {
					if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
						done(undefined);
						return;
					}
					if (matchesKey(data, Key.up)) scrollTo(scrollOffset - 1);
					else if (matchesKey(data, Key.down)) scrollTo(scrollOffset + 1);
					else if (matchesKey(data, "pageUp")) scrollTo(scrollOffset - pageSize);
					else if (matchesKey(data, "pageDown")) scrollTo(scrollOffset + pageSize);
					else if (matchesKey(data, Key.home)) scrollTo(0);
					else if (matchesKey(data, Key.end)) scrollTo(totalLines - pageSize);
					else {
						const mouse = parseSgrMousePacket(data);
						if (mouse?.final !== "M") return;
						const button = mouseBaseButton(mouse.code);
						if (button === 0 && (mouse.code & 32) === 0) {
							if (
								escHitbox &&
								mouse.row === escHitbox.row &&
								mouse.col >= escHitbox.startCol &&
								mouse.col <= escHitbox.endCol
							) {
								done(undefined);
								return;
							}
						}
						if (button === 64) scrollTo(scrollOffset - 3);
						else if (button === 65) scrollTo(scrollOffset + 3);
					}
				},
				render(width: number) {
					const inner = Math.max(1, width - 2);
					const escWidth = visibleWidth("[esc]");
					const bodyInner = Math.max(1, inner - 1);
					const bodyWidth = Math.max(1, bodyInner - 1);
					const terminalHeight = Math.max(1, tui.terminal.rows);
					const availableHeight = Math.max(1, terminalHeight - 4);
					const viewportHeight = Math.min(
						30,
						Math.max(1, Math.floor(terminalHeight * 0.8)),
						availableHeight,
					);
					pageSize = Math.max(1, viewportHeight - 6);
					const wrapped = markdownView.render(bodyWidth);
					totalLines = wrapped.length;
					scrollOffset = Math.min(scrollOffset, Math.max(0, totalLines - pageSize));
					// Centered overlay with margin 2: mirror TUI resolveOverlayLayout for anchor "center".
					const overlayTop = 2 + Math.floor((availableHeight - viewportHeight) / 2);
					const overlayLeft = Math.floor((Math.max(1, tui.terminal.columns) - width) / 2);
					escHitbox = escCloseHitbox({ left: overlayLeft, top: overlayTop, width });
					const visible = wrapped.slice(scrollOffset, scrollOffset + pageSize);
					const border = (text: string) => theme.fg("border", text);
					const padLine = (text: string, lineWidth = inner): string => {
						const truncated = truncateToWidth(text, lineWidth, "…");
						return truncated + " ".repeat(Math.max(0, lineWidth - visibleWidth(truncated)));
					};
					const scrollable = totalLines > pageSize;
					const thumbSize = scrollable
						? Math.max(1, Math.floor((pageSize * pageSize) / totalLines))
						: 0;
					const maxScrollOffset = Math.max(0, totalLines - pageSize);
					const thumbStart =
						scrollable && maxScrollOffset > 0
							? Math.round((scrollOffset / maxScrollOffset) * (pageSize - thumbSize))
							: 0;
					const scrollbar = (row: number): string => {
						if (!scrollable) return " ";
						const inThumb = row >= thumbStart && row < thumbStart + thumbSize;
						return theme.fg(inThumb ? "accent" : "borderMuted", inThumb ? "█" : "│");
					};
					const bodyRows = Array.from({ length: pageSize }, (_, row) => {
						const line = visible[row] ?? "";
						return `${border("│")}${padLine(` ${line}`, bodyInner)}${scrollbar(row)}${border("│")}`;
					});
					const start = totalLines === 0 ? 0 : scrollOffset + 1;
					const end = Math.min(totalLines, scrollOffset + pageSize);
					const status = `${start}-${end} / ${totalLines} lines · ↑↓ PgUp/PgDn Home/End · [esc] close`;

					return [
						border(`╭${"─".repeat(inner)}╮`),
						`${border("│")}${padLine(` ${theme.bold(theme.fg("accent", title))}`, inner - escWidth)}${theme.fg("muted", "[esc]")}${border("│")}`,
						`${border("├")}${border("─".repeat(inner))}${border("┤")}`,
						...bodyRows,
						`${border("├")}${border("─".repeat(inner))}${border("┤")}`,
						`${border("│")}${padLine(theme.fg("dim", ` ${status}`))}${border("│")}`,
						border(`╰${"─".repeat(inner)}╯`),
					];
				},
			};
		},
		{
			overlay: true,
			overlayOptions: { anchor: "center", width: "85%", minWidth: 50, maxHeight: "80%", margin: 2 },
		},
	);
}

type SgrMousePacket = {
	code: number;
	col: number;
	row: number;
	final: "M" | "m";
};

function parseSgrMousePacket(data: string): SgrMousePacket | null {
	const match = data.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/);
	if (!match) return null;
	return {
		code: Number(match[1]),
		col: Number(match[2]),
		row: Number(match[3]),
		final: match[4] as "M" | "m",
	};
}

function mouseBaseButton(code: number): number {
	return code & ~(4 | 8 | 16 | 32);
}

const tokenEstimate = (value: unknown): number => {
	if (!value) return 0;
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return Math.max(0, Math.ceil(text.length / 4));
};

type ToolPreviewInfo = {
	name: string;
	description?: string;
	promptGuidelines?: string[];
};

export function scaleParts(parts: ContextPart[], target: number): ContextPart[] {
	const estimated = parts.reduce((sum, part) => sum + part.tokens, 0);
	if (estimated === 0 || target <= 0) return parts;
	const scaled = parts.map((part) => ({
		...part,
		tokens: Math.round((part.tokens / estimated) * target),
	}));
	const delta = target - scaled.reduce((sum, part) => sum + part.tokens, 0);
	const largest = scaled.reduce(
		(best, part, index) => (part.tokens > scaled[best]!.tokens ? index : best),
		0,
	);
	scaled[largest]!.tokens += delta;
	return scaled;
}

export function formatTokens(tokens: number): string {
	if (tokens < 1_000) return String(tokens);
	if (tokens < 100_000) return `${(tokens / 1_000).toFixed(1)}k`;
	return `${Math.round(tokens / 1_000)}k`;
}

type SystemPromptOptions = {
	contextFiles?: Array<{ path: string; content: string }>;
	skills?: Array<{
		name: string;
		description?: string;
		filePath?: string;
		disableModelInvocation?: boolean;
	}>;
	selectedTools?: string[];
	toolSnippets?: Record<string, string>;
	promptGuidelines?: string[];
};

type ContextBreakdown = {
	parts: ContextPart[];
	options: SystemPromptOptions;
	systemPrompt: string;
};

/**
 * Single pass over prompt options + session entries. Returns options/systemPrompt
 * so the /context UI does not re-fetch or re-stringify the same sources.
 */
function collectContextBreakdown(ctx: ExtensionCommandContext): ContextBreakdown {
	const options = (ctx.getSystemPromptOptions?.() ?? {}) as SystemPromptOptions;
	const systemPrompt = typeof ctx.getSystemPrompt === "function" ? ctx.getSystemPrompt() : "";

	const contextFileTokens = (options.contextFiles ?? []).reduce(
		(sum, file) => sum + tokenEstimate(file.content),
		0,
	);
	// Prefer field-level estimates over JSON.stringify(whole skill).
	const skillTokens = (options.skills ?? []).reduce((sum, skill) => {
		if (!skill || typeof skill !== "object") return sum + tokenEstimate(skill);
		return (
			sum +
			tokenEstimate(skill.name) +
			tokenEstimate(skill.description) +
			tokenEstimate(skill.filePath)
		);
	}, 0);
	const tools = options.selectedTools ?? [];
	const snippets = options.toolSnippets;
	let toolTokens = tokenEstimate(options.promptGuidelines);
	for (const name of tools) {
		toolTokens += tokenEstimate(name) + tokenEstimate(snippets?.[name]);
	}

	let user = 0;
	let assistant = 0;
	let toolResults = 0;
	let summaries = 0;
	for (const entry of ctx.sessionManager.buildContextEntries()) {
		if (entry.type === "message") {
			const tokens = estimateTokens(entry.message);
			if (entry.message.role === "user") user += tokens;
			else if (entry.message.role === "assistant") assistant += tokens;
			else toolResults += tokens;
		} else if (entry.type === "compaction" || entry.type === "branch_summary") {
			summaries += tokenEstimate(entry);
		}
	}

	const systemTotal = tokenEstimate(systemPrompt);
	const baseSystem = Math.max(0, systemTotal - contextFileTokens - skillTokens - toolTokens);
	const parts: ContextPart[] = [
		{ label: "System prompt", tokens: baseSystem, color: "accent" },
		{ label: "Tools", tokens: toolTokens, color: "success" },
		{ label: "Context files", tokens: contextFileTokens, color: "warning" },
		{ label: "Skills", tokens: skillTokens, color: "warning" },
		{ label: "User messages", tokens: user, color: "muted" },
		{ label: "Assistant messages", tokens: assistant, color: "accent" },
		{ label: "Tool results", tokens: toolResults, color: "dim" },
		{ label: "Compaction summaries", tokens: summaries, color: "success" },
	];
	return {
		parts: parts.filter((part) => part.tokens > 0),
		options,
		systemPrompt,
	};
}

export default function contextUsageExtension(pi: ExtensionAPI) {
	pi.registerCommand("context", {
		description: "Show the current context-window distribution",
		handler: async (_args, ctx) => {
			const usage = ctx.getContextUsage();
			const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
			const breakdown = collectContextBreakdown(ctx);
			const used = usage?.tokens ?? breakdown.parts.reduce((sum, part) => sum + part.tokens, 0);
			const parts = scaleParts(breakdown.parts, used);
			const free = Math.max(0, contextWindow - used);
			const allParts = [...parts, { label: "Free space", tokens: free, color: "dim" as const }];

			if (ctx.mode !== "tui") {
				const lines = allParts.map((part) => `${part.label}: ${formatTokens(part.tokens)} tokens`);
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}

			const options = breakdown.options;
			const toolByName = new Map<string, ToolPreviewInfo>(
				(pi.getAllTools() as ToolPreviewInfo[]).map((tool) => [tool.name, tool] as const),
			);
			const toolContent = (options.selectedTools ?? []).map((name) => {
				const tool = toolByName.get(name);
				const lines = [`## ${name}`];
				if (tool?.description) lines.push(tool.description);
				if (options.toolSnippets?.[name]) lines.push(`Prompt: ${options.toolSnippets[name]}`);
				if (tool?.promptGuidelines?.length) {
					lines.push("Guidelines:", ...tool.promptGuidelines.map((guideline) => `- ${guideline}`));
				}
				return lines.join("\n");
			});
			if (options.promptGuidelines?.length) {
				toolContent.push(
					`## Shared prompt guidelines\n${options.promptGuidelines.map((guideline) => `- ${guideline}`).join("\n")}`,
				);
			}
			const contextFilesContent = (options.contextFiles ?? [])
				.map((file) => `===== ${file.path} =====\n${file.content}`)
				.join("\n\n");
			const skillsContent = (options.skills ?? [])
				.map((skill) =>
					[
						`## ${skill.name}`,
						skill.description,
						`Path: ${skill.filePath}`,
						`Model invocation: ${skill.disableModelInvocation ? "disabled" : "enabled"}`,
					]
						.filter(Boolean)
						.join("\n"),
				)
				.join("\n\n");
			const rawPreviews: ContextPreview[] = [
				{
					key: "systemPrompt",
					label: "System prompt",
					title: "System Prompt",
					content: breakdown.systemPrompt,
				},
				{
					key: "tools",
					label: "Tools",
					title: "Tools",
					content: toolContent.join("\n\n") || "No active tools.",
				},
				{
					key: "contextFiles",
					label: "Context files",
					title: "Context Files",
					content: contextFilesContent || "No context files loaded.",
				},
				{
					key: "skills",
					label: "Skills",
					title: "Skills",
					content: skillsContent || "No skills loaded.",
				},
			];
			const previews = rawPreviews.map((preview) => ({
				...preview,
				content: normalizePreviewText(preview.content),
			}));
			const previewByKey = new Map(previews.map((preview) => [preview.key, preview]));
			const visiblePreviews = previews.filter((preview) =>
				allParts.some((part) => part.label === preview.label),
			);
			let selectedPreviewIndex = 0;

			while (true) {
				const action = await ctx.ui.custom(
					(tui, theme, _keybindings, done) => {
						let previewHitboxes: Array<{
							key: PreviewKey;
							row: number;
							startCol: number;
							endCol: number;
						}> = [];
						let escHitbox: { row: number; startCol: number; endCol: number } | undefined;

						const padLine = (text: string, width: number): string => {
							const truncated = truncateToWidth(text, width, "…");
							return truncated + " ".repeat(Math.max(0, width - visibleWidth(truncated)));
						};

						return {
							invalidate() {},
							handleInput(data: string) {
								if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
									done(undefined);
									return;
								}
								if (matchesKey(data, Key.up) && visiblePreviews.length > 0) {
									selectedPreviewIndex =
										(selectedPreviewIndex - 1 + visiblePreviews.length) % visiblePreviews.length;
									tui.requestRender();
									return;
								}
								if (matchesKey(data, Key.down) && visiblePreviews.length > 0) {
									selectedPreviewIndex = (selectedPreviewIndex + 1) % visiblePreviews.length;
									tui.requestRender();
									return;
								}
								if (matchesKey(data, Key.enter)) {
									done(visiblePreviews[selectedPreviewIndex]?.key);
									return;
								}

								const mouse = parseSgrMousePacket(data);
								if (
									mouse?.final !== "M" ||
									mouseBaseButton(mouse.code) !== 0 ||
									(mouse.code & 32) !== 0
								)
									return;
								if (
									escHitbox &&
									mouse.row === escHitbox.row &&
									mouse.col >= escHitbox.startCol &&
									mouse.col <= escHitbox.endCol
								) {
									done(undefined);
									return;
								}
								const hitbox = previewHitboxes.find(
									(candidate) =>
										mouse.row === candidate.row &&
										mouse.col >= candidate.startCol &&
										mouse.col <= candidate.endCol,
								);
								if (hitbox) {
									selectedPreviewIndex = Math.max(
										0,
										visiblePreviews.findIndex((preview) => preview.key === hitbox.key),
									);
									done(hitbox.key);
								}
							},
							render(width: number) {
								const inner = Math.max(1, width - 2);
								const escWidth = visibleWidth("[esc]");
								const percent = contextWindow > 0 ? (used / contextWindow) * 100 : 0;
								const title = theme.bold(theme.fg("accent", "Context Usage"));
								const subtitle = `${formatTokens(used)} / ${formatTokens(contextWindow)} tokens (${percent.toFixed(1)}%)`;
								const barWidth = Math.max(1, Math.min(60, inner - 2));
								let remaining = barWidth;
								const segments = allParts
									.map((part, index) => {
										const cells =
											index === allParts.length - 1
												? remaining
												: Math.min(
														remaining,
														Math.round((part.tokens / Math.max(1, contextWindow)) * barWidth),
													);
										remaining -= cells;
										return theme.fg(part.color, "█".repeat(Math.max(0, cells)));
									})
									.join("");
								const labelWidth = Math.min(
									24,
									Math.max(...allParts.map((part) => part.label.length)),
								);
								const selectedLabel = visiblePreviews[selectedPreviewIndex]?.label;
								const partRows = allParts.map((part) => {
									const pct = contextWindow > 0 ? (part.tokens / contextWindow) * 100 : 0;
									const swatch = theme.fg(part.color, "■");
									const label = part.label.padEnd(labelWidth);
									const amount = `${formatTokens(part.tokens).padStart(7)}  ${pct.toFixed(1).padStart(5)}%`;
									const selected = part.label === selectedLabel;
									const prefix = selected ? "› " : "  ";
									const row = padLine(`${prefix}${swatch} ${label} ${amount}`, inner);
									return selected ? theme.bg("selectedBg", row) : row;
								});
								const border = (text: string) => theme.fg("border", text);
								const lines = [
									border(`╭${"─".repeat(inner)}╮`),
									`${border("│")}${padLine(` ${title}  ${theme.fg("muted", subtitle)}`, inner - escWidth)}${theme.fg("muted", "[esc]")}${border("│")}`,
									`${border("├")}${border("─".repeat(inner))}${border("┤")}`,
									`${border("│")}${padLine(` ${segments}`, inner)}${border("│")}`,
									`${border("│")}${" ".repeat(inner)}${border("│")}`,
									...partRows.map((row) => `${border("│")}${row}${border("│")}`),
									`${border("├")}${border("─".repeat(inner))}${border("┤")}`,
									`${border("│")}${padLine(theme.fg("dim", " ↑↓ select · Click / Enter to preview · [esc] close"), inner)}${border("│")}`,
									border(`╰${"─".repeat(inner)}╯`),
								];

								const terminalHeight = Math.max(1, tui.terminal.rows);
								const maxHeight = Math.min(
									Math.max(1, Math.floor(terminalHeight * 0.9)),
									Math.max(1, terminalHeight - 2),
								);
								const visibleHeight = Math.min(lines.length, maxHeight);
								const overlayTop =
									1 + Math.floor((Math.max(1, terminalHeight - 2) - visibleHeight) / 2);
								const overlayLeft = Math.floor((Math.max(1, tui.terminal.columns) - width) / 2);
								escHitbox = escCloseHitbox({ left: overlayLeft, top: overlayTop, width });
								previewHitboxes = visiblePreviews.flatMap((preview) => {
									const partIndex = allParts.findIndex((part) => part.label === preview.label);
									const line = 5 + partIndex;
									return partIndex >= 0 && line < visibleHeight
										? [
												{
													key: preview.key,
													row: overlayTop + line + 1,
													startCol: overlayLeft + 1,
													endCol: overlayLeft + width,
												},
											]
										: [];
								});

								return lines;
							},
						};
					},
					{
						overlay: true,
						overlayOptions: {
							anchor: "center",
							width: 64,
							minWidth: 44,
							maxHeight: "90%",
							margin: 1,
						},
					},
				);

				if (!action) break;
				const preview = previewByKey.get(action);
				if (!preview) continue;

				await showTextPreview(ctx, preview.title, preview.content);
			}
		},
	});
}
