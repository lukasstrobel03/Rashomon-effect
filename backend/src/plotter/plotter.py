import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import json


def plot_interaction(plot):
    """
    Function to plot interaction data.

    Parameters:
    - data: list[dict] - The data to plot, should include information necessary
                         for plotting interaction plots.
    """

    fig, ax = plt.subplots()
    im = ax.pcolormesh(
        plot["X"],
        plot["Y"],
        plot["Z"],
        shading="flat",
    )
    fig.colorbar(im, ax=ax)

    # ax.set_xticklabels([""] + plot["x_labels"])
    # ax.set_yticklabels([""] + plot["y_labels"])
    plt.title(f"Interaction Plot of {plot['y_name']} and {plot['x_name']}")
    plt.xlabel(plot["x_name"])
    plt.ylabel(plot["y_name"])

    if plot["y_ticks"]:
        plt.yticks(plot["y_ticks"], plot["y_labels"], rotation=90, va="center")

    plt.show()


def plot_categorical(plot):
    """
    Function to plot categorical data.

    Parameters:
    - data: list[dict] - The data to plot, should include information necessary
                         for plotting categorical plots.
    """

    plt.figure()
    plt.xlim(0, 1)
    plt.xticks(ticks=[0.25, 0.75], labels=plot["x_labels"])
    plt.step(plot["X"], plot["Y"], where="post")
    plt.title(plot["x_name"])
    plt.xlabel(plot["x_name"])
    plt.ylabel(plot["y_name"])
    # plt.show()
    plt.close()


def plot_numerical(plot):
    """
    Function to plot numerical data.

    Parameters:
    - data: list[dict] - The data to plot, should include information necessary
                         for plotting numerical plots.
    """

    plt.figure()
    plt.step(plot["X"], plot["Y"], where="post")
    plt.title(plot["feat_name"])
    plt.xlabel(plot["x_name"])
    plt.ylabel(plot["y_name"])
    plt.xlim(plot["x_min"], plot["x_max"])
    # plt.show()
    plt.close()


with open("plot_data.json", "r") as file:
    plot_data = json.load(file)

    for plots in plot_data:
        for plot in plots["plot_data"]:
            if plot["type"] == "numerical":
                plot_numerical(plot)
            elif plot["type"] == "categorical":
                plot_categorical(plot)
            elif plot["type"] == "interaction":
                plot_interaction(plot)
        break
