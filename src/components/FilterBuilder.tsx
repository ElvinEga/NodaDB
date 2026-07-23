import { useState } from 'react';
import { X, Plus, Filter as FilterIcon, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { TableColumn } from '@/types';
import {
  TableFilter,
  FilterOperator,
  getOperatorsForDataType,
  buildWhereClause
} from '@/types/filter';
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface FilterBuilderProps {
  columns: TableColumn[];
  filters: TableFilter[];
  onFiltersChange: (filters: TableFilter[]) => void;
  onApply: (whereClause: string) => void;
  onClear: () => void;
}

export function FilterBuilder({
  columns,
  filters,
  onFiltersChange,
  onApply,
  onClear
}: FilterBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const addFilter = () => {
    const newFilter: TableFilter = {
      id: crypto.randomUUID(),
      column: columns[0]?.name || '',
      operator: 'equals',
      value: '',
      dataType: columns[0]?.data_type || 'TEXT',
    };
    onFiltersChange([...filters, newFilter]);
    setIsExpanded(true);
  };

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<TableFilter>) => {
    onFiltersChange(
      filters.map(f =>
        f.id === id
          ? { ...f, ...updates }
          : f
      )
    );
  };

  const handleColumnChange = (filterId: string, columnName: string) => {
    const column = columns.find(c => c.name === columnName);
    if (column) {
      updateFilter(filterId, {
        column: columnName,
        dataType: column.data_type,
        operator: 'equals', // Reset operator when column changes
        value: '', // Reset value when column changes
      });
    }
  };

  const handleApply = () => {
    const whereClause = buildWhereClause(filters);
    onApply(whereClause);
  };

  const handleClear = () => {
    onFiltersChange([]);
    onClear();
    setIsExpanded(false);
  };

  const activeFilterCount = filters.length;

  return (
    <div className="border-b border-border bg-secondary/30">
      {/* Filter Header */}
      <div className="h-10 px-4 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
        >
          <FilterIcon className="h-3.5 w-3.5" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {filters.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 text-xs"
              >
                Clear All
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleApply}
                className="h-7 text-xs"
              >
                Apply Filters
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={addFilter}
            className="h-7 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Filter
          </Button>
        </div>
      </div>

      {/* Filter List */}
      {isExpanded && filters.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {filters.map((filter, index) => {
            const column = columns.find(c => c.name === filter.column);
            const operators = column ? getOperatorsForDataType(column.data_type) : [];
            const selectedOperator = operators.find(op => op.value === filter.operator);
            const requiresValue = selectedOperator?.requiresValue ?? true;

            return (
              <div
                key={filter.id}
                className="flex items-center gap-2 p-2 bg-background rounded-md border border-border"
              >
                <span className="text-xs text-muted-foreground w-8">
                  {index === 0 ? 'WHERE' : 'AND'}
                </span>

                {/* Column Selection */}
                <Select
                  value={filter.column}
                  onValueChange={(value) => handleColumnChange(filter.id, value)}
                >
                  <SelectTrigger className="h-8 text-xs w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.name} value={col.name} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span>{col.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {col.data_type}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Operator Selection */}
                <Select
                  value={filter.operator}
                  onValueChange={(value) => updateFilter(filter.id, { operator: value as FilterOperator })}
                >
                  <SelectTrigger className="h-8 text-xs w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.value} value={op.value} className="text-xs">
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value Input */}
                {requiresValue && (() => {
                  const typeFamily = column?.type_family;
                  const isBoolean = typeFamily === 'boolean';
                  const isNumber = typeFamily === 'integer' || typeFamily === 'float' || typeFamily === 'decimal';
                  const isDateTime = typeFamily === 'date_time' || typeFamily === 'date' || typeFamily === 'time';
                  const isEnum = typeFamily === 'enum' || (column?.enum_values && column.enum_values.length > 0);

                  return (
                    <div className="flex-1 min-w-[200px]">
                      {isBoolean ? (
                        <Select
                          value={filter.value}
                          onValueChange={(val) => updateFilter(filter.id, { value: val })}
                        >
                          <SelectTrigger className="h-8 text-xs w-full bg-background border-border">
                            <SelectValue placeholder="Select boolean..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true" className="text-xs">True</SelectItem>
                            <SelectItem value="false" className="text-xs">False</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : isEnum ? (
                        <Select
                          value={filter.value}
                          onValueChange={(val) => updateFilter(filter.id, { value: val })}
                        >
                          <SelectTrigger className="h-8 text-xs w-full bg-background border-border">
                            <SelectValue placeholder="Select enum..." />
                          </SelectTrigger>
                          <SelectContent>
                            {column?.enum_values?.map((val) => (
                              <SelectItem key={val} value={val} className="text-xs">
                                {val}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : isDateTime ? ( (() => {
                        const isBetween = filter.operator === 'between';

                        let selectedRange: DateRange | undefined = undefined;
                        if (isBetween && filter.value) {
                          const parts = filter.value.split(',');
                          const fromDate = parts[0] ? new Date(parts[0]) : undefined;
                          const toDate = parts[1] ? new Date(parts[1]) : undefined;
                          if (fromDate && !isNaN(fromDate.getTime())) {
                            selectedRange = {
                              from: fromDate,
                              to: toDate && !isNaN(toDate.getTime()) ? toDate : undefined,
                            };
                          }
                        }

                        const selectedDate = !isBetween && filter.value ? new Date(filter.value.includes(" ") ? filter.value.split(" ")[0] : filter.value) : undefined;
                        const isValidDate = selectedDate && !isNaN(selectedDate.getTime());

                        if (isBetween) {
                          const getButtonText = () => {
                            if (selectedRange?.from) {
                              const fromStr = format(selectedRange.from, "yyyy-MM-dd");
                              const toStr = selectedRange.to ? format(selectedRange.to, "yyyy-MM-dd") : "Pick end date";
                              return `${fromStr} - ${toStr}`;
                            }
                            return "Pick date range...";
                          };

                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "h-8 text-xs w-full justify-start text-left font-normal bg-background border-border",
                                    !filter.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                  <span>{getButtonText()}</span>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 z-[100]" align="start">
                                <Calendar
                                  mode="range"
                                  selected={selectedRange}
                                  onSelect={(range) => {
                                    if (range) {
                                      const fromStr = range.from ? format(range.from, "yyyy-MM-dd 00:00:00") : "";
                                      const toStr = range.to ? format(range.to, "yyyy-MM-dd 23:59:59") : "";
                                      updateFilter(filter.id, { value: `${fromStr},${toStr}` });
                                    } else {
                                      updateFilter(filter.id, { value: "" });
                                    }
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                          );
                        }

                        // Single Date / Datetime
                        if (typeFamily === "date_time") {
                          const timeVal = filter.value && filter.value.includes(" ") ? filter.value.split(" ")[1] : "12:00:00";
                          return (
                            <div className="flex gap-1.5 justify-between w-full">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      "h-8 text-xs flex-1 justify-start text-left font-normal bg-background border-border",
                                      !filter.value && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                    <span className="truncate">{isValidDate ? format(selectedDate!, "yyyy-MM-dd") : "Pick date..."}</span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-[100]" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={isValidDate ? selectedDate : undefined}
                                    onSelect={(date) => {
                                      if (date) {
                                        updateFilter(filter.id, {
                                          value: `${format(date, "yyyy-MM-dd")} ${timeVal}`
                                        });
                                      } else {
                                        updateFilter(filter.id, { value: "" });
                                      }
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                              <Input
                                type="time"
                                step="1"
                                value={timeVal}
                                onChange={(e) => {
                                  const newTime = e.target.value || "12:00:00";
                                  const dateStr = isValidDate ? format(selectedDate!, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
                                  updateFilter(filter.id, { value: `${dateStr} ${newTime}` });
                                }}
                                className="h-8 text-xs w-[108px] bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                              />
                            </div>
                          );
                        }

                        // Pure Date
                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-8 text-xs w-full justify-start text-left font-normal bg-background border-border",
                                  !filter.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                <span>{isValidDate ? format(selectedDate!, "yyyy-MM-dd") : "Pick date..."}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 z-[100]" align="start">
                              <Calendar
                                mode="single"
                                selected={isValidDate ? selectedDate : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    updateFilter(filter.id, {
                                      value: format(date, "yyyy-MM-dd")
                                    });
                                  } else {
                                    updateFilter(filter.id, { value: "" });
                                  }
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        );
                      })() )
                      : (
                        <Input
                          type={isNumber ? "number" : "text"}
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                          placeholder={
                            filter.operator === 'like' || filter.operator === 'not_like'
                              ? 'Use % for wildcards'
                              : filter.operator === 'in' || filter.operator === 'not_in'
                              ? 'Comma-separated values'
                              : 'Enter value...'
                          }
                          className="h-8 text-xs w-full"
                        />
                      )}
                    </div>
                  );
                })()}

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilter(filter.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
