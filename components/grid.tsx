import React, { createContext, useContext, useMemo } from 'react';
import type { ViewProps, DimensionValue } from 'react-native';
import { View, StyleSheet } from 'react-native';

const GridContext = createContext({ columns: 12, gap: 0 });

interface GridProps extends ViewProps {
  columns?: number;
  gap?: number;
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 12,
  gap = 0,
  style,
}) => {
  const gridStyle = useMemo(
    () => ({
      columns,
      gap,
    }),
    [columns, gap]
  );

  return (
    <GridContext.Provider value={gridStyle}>
      <View style={[styles.grid, style]}>{children}</View>
    </GridContext.Provider>
  );
};

interface ColProps extends ViewProps {
  span?: number;
}

export const Col: React.FC<ColProps> = ({ span = 1, style, ...props }) => {
  const { columns, gap } = useContext(GridContext);

  const columnStyle = useMemo(
    () => ({
      paddingHorizontal: gap / 2,
      width: `${(span / columns) * 100}%` as DimensionValue,
    }),
    [columns, span, gap]
  );

  return <View style={[columnStyle, style]} {...props} />;
};

type RowProps = ViewProps;

export const Row: React.FC<RowProps> = ({ style, ...props }) => {
  const { gap } = useContext(GridContext);

  const rowStyle = useMemo(() => ({ marginHorizontal: -(gap / 2) }), [gap]);

  return <View style={[styles.row, rowStyle, style]} {...props} />;
};

const styles = StyleSheet.create({
  grid: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
