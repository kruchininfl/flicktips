<?php

namespace Services;

class Mapper
{
    static function group(array $rows, $key, array $fieldsOptions)
    {
        $result = [];
        foreach ($rows as $row) {
            foreach ($row as $field => $value) {

                $fieldOptions = @$fieldsOptions[$field];

                if (isset($fieldOptions['type'])) {
                    settype($value, $fieldOptions['type']);
                }

                $newFieldName = isset($fieldOptions['rename']) ? $fieldOptions['rename'] : $field;

                if (isset($fieldOptions['group'])) {
                    $groupId = $row[$fieldOptions['group_id_field']];
                    if (isset($groupId) && $groupId != '') {
                        @$result[$row[$key]][$fieldOptions['group']][$groupId][$newFieldName] = $value;
                    }
                } else {
                    @$result[$row[$key]][$newFieldName] = $value;
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