import React, { useMemo } from 'react';
import Slider, { SliderProps } from '@react-native-community/slider';
import debounce from 'lodash.debounce';

interface DebouncedSliderProps extends Omit<SliderProps, 'onValueChange'> {
  onValueChange: (value: number) => void;
  debounceMs?: number;
}

export const DebouncedSlider: React.FC<DebouncedSliderProps> = ({
  onValueChange,
  debounceMs = 150,
  ...props
}) => {

  const debouncedChange = useMemo(
    () => debounce(onValueChange, debounceMs),
    [onValueChange, debounceMs]
  );

  return (
    <Slider
      {...props}
      onValueChange={(val) => {
        debouncedChange(val);
      }}
    />
  );
};
