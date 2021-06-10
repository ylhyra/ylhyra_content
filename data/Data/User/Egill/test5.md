---
title: Data:User:Egill/test5
---

{
    "list": {
        "arrayOfAllItemIDs": [
            "s_1rby0",
            "w_1rby1",
            "s_1rby2",
            "w_1rby3",
            "w_1rby4"
        ],
        "arrayOfAllWordIDs": [
            "w_1rby1",
            "w_1rby3",
            "w_1rby4"
        ],
        "items": {
            "s_1rby0": {
                "id": "s_1rby0",
                "text": "sdf",
                "words": [
                    {
                        "id": "w_1rby1",
                        "text": "sdf"
                    }
                ]
            },
            "s_1rby2": {
                "id": "s_1rby2",
                "text": "haha haha",
                "words": [
                    {
                        "id": "w_1rby3",
                        "text": "haha"
                    },
                    " ",
                    {
                        "id": "w_1rby4",
                        "text": "haha"
                    }
                ]
            },
            "w_1rby1": {
                "belongsToSentence": "s_1rby0",
                "id": "w_1rby1",
                "text": "sdf"
            },
            "w_1rby3": {
                "belongsToSentence": "s_1rby2",
                "id": "w_1rby3",
                "text": "haha"
            },
            "w_1rby4": {
                "belongsToSentence": "s_1rby2",
                "id": "w_1rby4",
                "text": "haha"
            }
        },
        "sentences": {
            "s_1rby0": {
                "id": "s_1rby0",
                "text": "sdf",
                "words": [
                    {
                        "id": "w_1rby1",
                        "text": "sdf"
                    }
                ]
            },
            "s_1rby2": {
                "id": "s_1rby2",
                "text": "haha haha",
                "words": [
                    {
                        "id": "w_1rby3",
                        "text": "haha"
                    },
                    " ",
                    {
                        "id": "w_1rby4",
                        "text": "haha"
                    }
                ]
            }
        },
        "words": {
            "w_1rby1": {
                "belongsToSentence": "s_1rby0",
                "id": "w_1rby1",
                "text": "sdf"
            },
            "w_1rby3": {
                "belongsToSentence": "s_1rby2",
                "id": "w_1rby3",
                "text": "haha"
            },
            "w_1rby4": {
                "belongsToSentence": "s_1rby2",
                "id": "w_1rby4",
                "text": "haha"
            }
        }
    },
    "long_audio": {},
    "short_audio": {
        "soundList": [],
        "sounds": {}
    },
    "suggestions": {},
    "tokenized": [
        {
            "hash": "375gt0",
            "hashOfIds": "1l6wryi",
            "index": 0,
            "sentences": [
                {
                    "id": "s_1rby0",
                    "text": "sdf",
                    "words": [
                        {
                            "id": "w_1rby1",
                            "text": "sdf"
                        }
                    ]
                }
            ]
        },
        {
            "hash": "1pq8139",
            "hashOfIds": "vg6591",
            "index": 1,
            "sentences": [
                {
                    "id": "s_1rby2",
                    "text": "haha haha",
                    "words": [
                        {
                            "id": "w_1rby3",
                            "text": "haha"
                        },
                        " ",
                        {
                            "id": "w_1rby4",
                            "text": "haha"
                        }
                    ]
                }
            ]
        }
    ],
    "translation": {
        "definitions": {
            "favgn6": {
                "contains": [
                    "w_1rby3",
                    "w_1rby4"
                ],
                "meaning": "LOL"
            }
        },
        "sentences": {},
        "words": {
            "w_1rby3": "favgn6",
            "w_1rby4": "favgn6"
        }
    }
}