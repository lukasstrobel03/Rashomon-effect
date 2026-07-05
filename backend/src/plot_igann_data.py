import json
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np
 
JSON_FILE = "30052026plot_data.json"
 
try:
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)
except FileNotFoundError:
    raise SystemExit(
        f"Datei '{JSON_FILE}' nicht gefunden. "
        "Bitte den Pfad am Anfang des Skripts anpassen."
    )
data: dict = raw[0]

def plot_feature(ax_shape, ax_hist, feat: dict, color: str = "#1f77b4"):
    """Zeichnet Shape-Kurve + Histogramm für ein Feature."""
    name  = feat["name"]
    x     = np.array(feat["x"])
    y     = np.array(feat["y"])
    edges = np.array(feat["hist"]["edges"])
    counts = np.array(feat["hist"]["counts"])
    avg   = feat["avg_effect"]

    mask = counts > 0

    ax_shape.plot(x, y, color=color, linewidth=1.8)
    ax_shape.axhline(0, color="gray", linewidth=0.6, linestyle="--", alpha=0.5)
    ax_shape.set_ylabel("Score", fontsize=9)
    ax_shape.set_title(f"{name}\n(avg |effect|: {avg:.2f})", fontsize=9,
                       fontweight="bold")
    ax_shape.tick_params(labelsize=8)
    ax_shape.grid(True, alpha=0.25)
 
    widths = np.diff(edges)
    ax_hist.bar(
        edges[:-1][mask], counts[mask],
        width=widths[mask], align="edge",
        color=color, alpha=0.35, linewidth=0
    )
    ax_hist.set_xlabel(name, fontsize=9)
    ax_hist.tick_params(labelsize=7)
    ax_hist.set_yticks([])
    ax_hist.grid(False)

features = list(data.values())
n = len(features)
 
# Farbpalette
palette = ["#1f77b4", "#d62728", "#2ca02c", "#ff7f0e", "#9467bd",
           "#8c564b", "#e377c2"]
 
fig = plt.figure(figsize=(5 * n, 5), constrained_layout=True)
fig.suptitle("IGANN – Shape Functions", fontsize=13, fontweight="bold", y=1.02)
 
outer = gridspec.GridSpec(1, n, figure=fig, wspace=0.35)
 
for i, feat in enumerate(features):
    inner = gridspec.GridSpecFromSubplotSpec(
        2, 1, subplot_spec=outer[i], height_ratios=[3, 1], hspace=0.08
    )
    ax_shape = fig.add_subplot(inner[0])
    ax_hist  = fig.add_subplot(inner[1], sharex=ax_shape)
 
    color = palette[i % len(palette)]
    plot_feature(ax_shape, ax_hist, feat, color=color)
 

    plt.setp(ax_shape.get_xticklabels(), visible=False)
 
out_path = "igann_shape_functions.png"
fig.savefig(out_path, dpi=150, bbox_inches="tight")
print(f"Gespeichert: {out_path}")
plt.show()