import { useRef, useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import {Data} from 'plotly.js';
import {type DashboardData} from './data.tsx';
import './DashboardBandit.css';

export function prepareData(dashboardData: DashboardData): Data[] {
    switch(dashboardData.type) {
        case "categorical":
            return [{
                x: dashboardData.X,
                y: dashboardData.Y,
                type: 'bar',
                name: dashboardData.feat_name,
            }]
        case "numerical":
            return [{
                x: dashboardData.X,
                y: dashboardData.Y,
                type: 'scatter',
                mode: 'lines',
                line: {shape: dashboardData.smooth ? 'spline' : 'hv'},
                name: dashboardData.feat_name,
            }]
        case "interaction":
            return [{
               x: dashboardData.X,
               y: dashboardData.Y,
               z: dashboardData.Z as Array<Array<number>>,
               type: 'heatmap',
               colorbar: {len: 1.5, thickness: 8 }
            }]
    }
}

function formatTicks(ticks: number[] | null, labels: string[] | null) : object {
    return (ticks === null || labels === null) ?
        {
            tickmode: 'auto'
        } :
        {
            tickmode: 'array',
            tickvals: ticks ?? undefined,
            ticktext: labels ?? undefined
         }
}


export const DashboardPlot = ({ dashboardData }: { dashboardData: DashboardData }): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });

    useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        console.log({width, height})
        setDimensions({ width, height });
      }
    };

    // Initial update
    updateDimensions();

    // Create a ResizeObserver
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Cleanup
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);

  return (
      <div className="chart-item-inner" ref={containerRef}>
          {dimensions.width > 0 && dimensions.height > 0 && (
            <Plot
              data={prepareData(dashboardData)}
              layout={{
                width: dimensions.width,
                height: dimensions.height,
                title: dashboardData.feat_name,
                margin: { l: 0, r: 0, t: 35, b: 25 },
                dragmode: false,
                xaxis: {
                  automargin: true,
                  title: {
                      text: dashboardData.x_name,
                      standoff: 10,
                  },
                  ...formatTicks(dashboardData.x_ticks, dashboardData.x_labels),
                    
                },
                yaxis: {
                  automargin: true,
                  title: {
                      text: dashboardData.y_name,
                      standoff: 10,
                  },
                  ...formatTicks(dashboardData.y_ticks, dashboardData.y_labels)
                },
              }}
              config={{
                displayModeBar: false,
              }}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler={true}
            />
          )}
      </div>
  );
};


const Dashboard = ({plotData}: { plotData: DashboardData[]}) => {


  return (
    <div className="dashboard-container">
      <div className="chart-grid">
        {plotData.map((data, index) => (
          <div className="chart-item" key={index}>
              <DashboardPlot dashboardData={data}/>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;