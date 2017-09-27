<?php

namespace Services;

class Mapper
{
    static function group(array $rows, $keys, array $fieldsOptions)
    {
        $result = [];
        foreach ($rows as $row) {
            if (is_array($keys)) {
                $key = implode('_', array_map(function ($k) use ($row) {
                    return $row[$k];
                }, $keys));
            } else {
                $key = $row[$keys];
            }

            foreach ($row as $field => $value) {

                $fieldOptions = @$fieldsOptions[$field];

                if (isset($fieldOptions['type'])) {
                    settype($value, $fieldOptions['type']);
                }

                $newFieldName = isset($fieldOptions['rename']) ? $fieldOptions['rename'] : $field;

                if (isset($fieldOptions['group'])) {
                    if (is_array($fieldOptions['group_id_field'])) {
                        $filtered = array_filter ( $fieldOptions['group_id_field'], function ($v) use ($row) {
                            return isset($row[$v]) && $row[$v] != '';
                        });

                        if (count($filtered) == count($fieldOptions['group_id_field'])) {
                            $mapped = array_map(function ($v) use ($row) {
                                return $row[$v];
                            }, $fieldOptions['group_id_field']);
                            $groupId = implode('_', $mapped);
                        } else {
                            $groupId = null;
                        }
                    } else {
                        $groupId = $row[$fieldOptions['group_id_field']];
                    }

                    if (isset($groupId) && $groupId != '') {
                        @$result[$key][$fieldOptions['group']][$groupId][$newFieldName] = $value;
                    }
                } else {
                    @$result[$key][$newFieldName] = $value;
                }
            }
        }

        $result = array_values($result);


        foreach ($fieldsOptions as $field => $options) {
            $group = @$options['group'];
            if (isset($group)) {
                foreach ($result as &$item) {
                    if (isset($item[$group])) {
                        $item[$group] = array_values($item[$group]);
                    }
                }
            }
        }

        return $result;
    }
}