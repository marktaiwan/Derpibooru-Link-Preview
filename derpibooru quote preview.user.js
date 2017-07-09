// ==UserScript==
// @name         Derpibooru Comment Enhancements
// @description  Improvements to Derpibooru's comment section
// @version      1.3.6
// @author       Marker
// @namespace    https://github.com/marktaiwan/
// @homepageURL  https://github.com/marktaiwan/Derpibooru-Link-Preview
// @supportURL   https://github.com/marktaiwan/Derpibooru-Link-Preview/issues
// @include      /^https?://(www\.)?(derpibooru|trixiebooru)\.org/(images/)?\d{1,}(/comments/\d{1,}/edit|\?.{1,}|\?|/|\.html)?$/
// @include      /^https?://(www\.)?(derpibooru|trixiebooru)\.org/lists/user_comments/\d{1,}(\?|\?.{1,}|/|\.html)?$/
// @include      /^https?://(www\.)?(derpibooru|trixiebooru)\.org/lists/(my_comments|recent_comments)(\?|\?.{1,}|/|\.html)?$/
// @include      /^https?://(www\.)?(derpibooru|trixiebooru)\.org/(forums/)?(art|writing|dis|generals|pony|rp|meta|tagging|uppers)/?(.+)?$/
// @include      /^https?://(www\.)?(derpibooru|trixiebooru)\.org/images/new(/|\.html)?$/
// @include      /^https?://(www\.)?(derpibooru|trixiebooru)\.org/messages/.+$/
// @grant        none
// @require      https://openuserjs.org/src/libs/soufianesakhi/node-creation-observer.js
// ==/UserScript==

(function() {
    'use strict';

    const HOVER_ATTRIBUTE = 'comment-preview-active';
    var fetchCache = {};
    var backlinksCache = {};
    var textareaSelectors = [
        '#comment_body',
        '#post_body',
        '#description',
        '#image_description',
        '#topic_posts_attributes_0_body',
        '#message_body'
    ];
    var formattingSyntax = {
        bold: {
            displayText: 'B',
            altText: 'bold',
            styleCSS: 'font-weight: bold;',
            options: {
                prefix: '*',
                suffix: '*'
            },
            edit: wrapSelection,
            shortcutKey: 'b'
        },
        italics: {
            displayText: 'i',
            altText: 'italics',
            styleCSS: 'font-style: italic;',
            options: {
                prefix: '_',
                suffix: '_'
            },
            edit: wrapSelection,
            shortcutKey: 'i'
        },
        under: {
            displayText: 'U',
            altText: 'underline',
            styleCSS: 'text-decoration: underline;',
            options: {
                prefix: '+',
                suffix: '+'
            },
            edit: wrapSelection,
            shortcutKey: 'u'
        },
        spoiler: {
            displayText: 'spoiler',
            altText: 'mark as spoiler',
            styleCSS: '',
            options: {
                prefix: '[spoiler]',
                suffix: '[/spoiler]'
            },
            edit: wrapSelection,
            shortcutKey: 's'
        },
        code: {
            displayText: 'code',
            altText: 'code formatting',
            styleCSS: 'font-family: "Courier New", Courier, monospace;',
            options: {
                prefix: '@',
                suffix: '@'
            },
            edit: wrapSelection
        },
        strike: {
            displayText: 'strike',
            altText: 'strikethrough',
            styleCSS: 'text-decoration: line-through;',
            options: {
                prefix: '-',
                suffix: '-'
            },
            edit: wrapSelection
        },
        superscript: {
            displayText: '<sup>sup</sup>',
            altText: 'superscript',
            options: {
                prefix: '^',
                suffix: '^'
            },
            edit: wrapSelection
        },
        subscript: {
            displayText: '<sub>sub</sub>',
            altText: 'subscript',
            options: {
                prefix: '~',
                suffix: '~'
            },
            edit: wrapSelection
        },
        link: {
            displayText: '',
            altText: 'insert hyperlink',
            styleCSS: 'font: normal normal normal 14px/1 FontAwesome; text-rendering: auto; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;',
            glyph: '\\f0c1',
            options: {
                prefix: '"',
                suffix: '":',
                insertLink: true
            },
            edit: wrapSelection
        },
        image: {
            displayText: '',
            altText: 'insert image',
            styleCSS: 'font: normal normal normal 14px/1 FontAwesome; text-rendering: auto; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;',
            glyph: '\\f03e',
            options: {
                prefix: '!',
                suffix: '!',
                insertImage: true
            },
            edit: wrapSelection
        },
        no_parse: {
            displayText: 'no parse',
            altText: 'Text you want the parser to ignore',
            options: {
                prefix: '[==',
                suffix: '==]'
            },
            edit: wrapSelection
        }
    };

    function displayHover(comment, sourceLink) {
        const PADDING = 5; // in pixels

        comment = comment.cloneNode(true);
        comment.id = 'hover_preview';
        comment.style.position = 'absolute';
        comment.style.maxWidth = '980px';
        comment.style.minWidth = '490px';
        comment.style.boxShadow = '0px 0px 12px 0px rgba(0, 0, 0, 0.4)';

        // Make spoiler visible
        var i;
        var list = comment.querySelectorAll('span.spoiler, span.imgspoiler, span.imgspoiler img');
        if (list !== null) {
            for (i = 0; i < list.length; i++) {

                if (list[i].matches('span')) {
                    list[i].style.color = '#333';
                    list[i].style.backgroundColor = (list[i].matches('span.imgspoiler')) ? '' : '#f7d4d4';
                } else {
                    list[i].style.visibility = 'visible';
                }

            }
        }

        // highlight reply link
        var ele = sourceLink;
        while (ele.parentElement !== null && !ele.matches('article')) ele = ele.parentElement;
        var sourceCommentID = ele.id.slice(8);

        list = comment.querySelectorAll('a[href$="#comment_' + sourceCommentID + '"]');
        if (list !== null) {
            for (i = 0; i < list.length; i++) list[i].style.textDecoration = 'underline dashed';
        }

        // relative time
        window.booru.timeAgo(comment.querySelectorAll('time'));

        var container = document.getElementById('image_comments') || document.getElementById('content');
        if (container) container.appendChild(comment);

        // calculate link position
        var linkRect = sourceLink.getBoundingClientRect();
        var linkTop = linkRect.top + viewportPosition().top;
        var linkLeft = linkRect.left + viewportPosition().left;

        var commentRect = comment.getBoundingClientRect();
        var commentTop;
        var commentLeft;


        if (sourceLink.parentElement.classList.contains('comment_backlinks')) {
            // When there is room, place the preview below the link,
            // otherwise place it above the link
            if (document.documentElement.clientHeight - linkRect.bottom > commentRect.height + PADDING) {

                commentTop = linkTop + linkRect.height + PADDING;
                commentLeft = (commentRect.width + linkLeft < document.documentElement.clientWidth) ? (
                    linkLeft
                ) : (
                    document.documentElement.clientWidth - (commentRect.width + PADDING)
                );

            } else {

                commentTop = linkTop - commentRect.height - PADDING;
                commentLeft = (commentRect.width + linkLeft < document.documentElement.clientWidth) ? (
                    linkLeft
                ) : (
                    document.documentElement.clientWidth - (commentRect.width + PADDING)
                );

            }
        } else {
            // When there is room, place the preview above the link
            // otherwise place it to the right and aligns it to the top of viewport
            if (linkRect.top > commentRect.height + PADDING) {

                commentTop = linkTop - commentRect.height - PADDING;
                commentLeft = (commentRect.width + linkLeft < document.documentElement.clientWidth) ? (
                    linkLeft
                ) : (
                    document.documentElement.clientWidth - (commentRect.width + PADDING)
                );

            } else {

                commentTop = viewportPosition().top + PADDING;
                commentLeft = linkLeft + linkRect.width + PADDING;

            }
        }

        comment.style.top = commentTop + 'px';
        comment.style.left = commentLeft + 'px';
    }

    function linkEnter(sourceLink, targetCommentID) {

        sourceLink.setAttribute(HOVER_ATTRIBUTE, 1);

        var targetComment = document.getElementById('comment_' + targetCommentID);

        if (targetComment !== null) {

            if (!elementInViewport(targetComment)) {
                displayHover(targetComment, sourceLink);
            }

            // Highlight linked post
            targetComment.children[0].style.backgroundColor = 'rgba(230,230,30,0.3)';
            if (targetComment.querySelector('.comment_backlinks') !== null) targetComment.children[1].style.backgroundColor = 'rgba(230,230,30,0.3)';

        } else {

            // External post, display from cached response if possible
            if (fetchCache[targetCommentID] !== undefined) {

                displayHover(fetchCache[targetCommentID], sourceLink);

            } else {

                fetch(window.location.origin + '/comment/' + targetCommentID + '.html')
                    .then((response) => response.text())
                    .then((text) => {
                        if (fetchCache[targetCommentID] === undefined && sourceLink.getAttribute(HOVER_ATTRIBUTE) !== '0') {
                            var d = document.createElement('div');
                            d.innerHTML = text;
                            fetchCache[targetCommentID] = d.firstChild;
                            displayHover(d.firstChild, sourceLink);
                        }
                    });

            }

        }
    }

    function linkLeave(sourceLink, targetCommentID) {

        sourceLink.setAttribute(HOVER_ATTRIBUTE, 0);
        var targetComment = document.getElementById('comment_' + targetCommentID);
        var preview = document.getElementById('hover_preview');

        if (targetComment !== null) {
            targetComment.children[0].style.backgroundColor = '';  //remove comment highlight
            if (targetComment.querySelector('.comment_backlinks') !== null) targetComment.children[1].style.backgroundColor = '';
        }
        if (preview !== null) preview.parentElement.removeChild(preview);

    }

    // Chrome/Firefox compatibility hack for getting viewport position
    function viewportPosition() {
        return {
            top: (document.documentElement.scrollTop || document.body.scrollTop),
            left: (document.documentElement.scrollLeft || document.body.scrollLeft)
        };
    }

    function elementInViewport(el) {
        var rect = el.getBoundingClientRect();

        return (
            rect.top + (rect.height - 50) >= 0 &&
            rect.bottom - (rect.height - 50) <= document.documentElement.clientHeight
        );
    }

    function createBacklinksContainer(commentBody) {
        var ele = commentBody.querySelector('div.comment_backlinks');

        if (ele === null) {

            ele = document.createElement('div');
            ele.className = 'block__content comment_backlinks';
            ele.style.fontSize = '12px';
            ele.style.borderTop = window.getComputedStyle(commentBody.firstChild)['border-top'];

            commentBody.insertBefore(ele, commentBody.querySelector('.communication__options'));

        }
        return ele;
    }

    function insertBacklink(backlink, commentID) {

        // add to cache
        if (backlinksCache[commentID] === undefined) backlinksCache[commentID] = [];
        if (backlinksCache[commentID].findIndex((ele) => (ele.hash == backlink.hash)) == -1) {
            backlinksCache[commentID].push(backlink);
        }

        var commentBody = document.getElementById('comment_' + commentID);
        if (commentBody !== null) {
            var linksContainer = createBacklinksContainer(commentBody);

            // insertion sort the links so they are ordered by id
            if (linksContainer.children.length > 0) {

                var iLinkID = parseInt(backlink.hash.slice(9), 10);
                var iTempID;
                var i;

                for (i = 0; i < linksContainer.children.length; i++) {
                    iTempID = parseInt(linksContainer.children[i].hash.slice(9), 10);

                    if (iLinkID == iTempID) {  // prevent links to the same comment from being added multiple times
                        return;
                    }
                    if (iLinkID < iTempID) {
                        linksContainer.insertBefore(backlink, linksContainer.children[i]);
                        return;
                    }
                }

            }
            linksContainer.appendChild(backlink);
            return;
        }

    }

    function getQueryVariable(key, HTMLAnchorElement) {
        var i;
        var array = HTMLAnchorElement.search.substring(1).split('&');

        for (i = 0; i < array.length; i++) {
            if (key == array[i].split('=')[0]) {
                return array[i].split('=')[1];
            }
        }
    }

    function insertButton(displayText) {

        var commentsBlock = document.querySelector('.js-editable-comments');

        var ele = document.createElement('div');
        ele.className = 'block__header';
        ele.id = 'comment_loading_button';
        ele.style.textAlign = 'center';

        ele.appendChild(document.createElement('a'));
        ele.firstChild.style.padding = '0px';
        ele.firstChild.style.width = '100%';
        ele.firstChild.innerText = displayText;

        commentsBlock.insertBefore(ele, commentsBlock.lastElementChild);

        return ele;
    }

    function loadComments(e, imageId, nextPage, lastPage) {

        e.target.parentElement.remove();
        var btn = insertButton('Loading...');

        var fetchURL = window.location.origin + '/images/' + imageId + '/comments?id=' + imageId + '&page=' + nextPage;

        fetch(fetchURL, {credentials: 'same-origin'})  // cookie needed for correct pagination
            .then((response) => response.text())
            .then((text) => {

                // response text => documentFragment
                var ele = document.createElement('div');
                var range = document.createRange();

                ele.innerHTML = text;
                range.selectNodeContents(ele.firstChild);

                var fragment = range.extractContents();
                var commentsBlock = document.getElementById('image_comments');

                // update pagination blocks
                commentsBlock.replaceChild(fragment.firstChild, commentsBlock.firstElementChild);
                commentsBlock.replaceChild(fragment.lastChild, commentsBlock.lastElementChild);

                // page marker
                ele.innerHTML = '';
                ele.className = 'block block__header';
                ele.style.textAlign = 'center';
                ele.innerText = 'Page ' + nextPage;

                // relative time
                window.booru.timeAgo(fragment.querySelectorAll('time'));

                fragment.insertBefore(ele, fragment.firstElementChild);
                commentsBlock.insertBefore(fragment, commentsBlock.lastElementChild);


                // configure button to load the next batch of comments
                btn.remove();
                if (nextPage < lastPage) {
                    btn = insertButton('Load more comments');

                    btn.addEventListener('click', (e) => {
                        loadComments(e, imageId, nextPage + 1, lastPage);
                    });
                }

            });
    }

    function wrapSelection(box, options) {
        if (box === null) {
            return;
        }
        var hyperlink;
        var prefix = options.prefix;
        var suffix = options.suffix;

        // record scroll top to restore it later.
        var scrollTop = box.scrollTop;
        var selectionStart = box.selectionStart;
        var selectionEnd = box.selectionEnd;
        var text = box.value;
        var beforeSelection = text.substring(0, selectionStart);
        var selectedText = text.substring(selectionStart, selectionEnd);
        var afterSelection = text.substring(selectionEnd);

        var emptySelection = (selectedText === '');

        var trailingSpace = '';
        var cursor = selectedText.length - 1;

        // deselect trailing space and carriage return
        while (cursor > 0 && (selectedText[cursor] === ' ' || selectedText[cursor] === '\n')) {
            trailingSpace = selectedText[cursor] + trailingSpace;
            cursor--;
        }
        selectedText = selectedText.substring(0, cursor + 1);

        if (options.insertLink) {
            hyperlink = window.prompt('Enter link:');
            if (hyperlink === null || hyperlink === '') return;
            // change on-site link to use relative url
            if (hyperlink.startsWith(window.origin)) {
                hyperlink = hyperlink.substring(window.origin.length);
            }
            suffix += hyperlink;
        }

        if (options.insertImage) {
            hyperlink = window.prompt('Enter link to image:');
            if (hyperlink === null || hyperlink === '') return;
            // change on-site image to embed
            var resultsArray = hyperlink.match(/https?:\/\/(?:www\.)?(?:(?:derpibooru\.org|trixiebooru\.org)\/(?:images\/)?(\d{1,})(?:\?|\?.{1,}|\/|\.html)?|derpicdn\.net\/img\/(?:view\/)?\d{1,}\/\d{1,}\/\d{1,}\/(\d+))/i);
            if (resultsArray !== null) {
                var imageId = resultsArray[1] || resultsArray[2];
                if (imageId === undefined) {
                    console.error('Derpibooru Comment Preview: Unable to extract image ID from link: ' + hyperlink);
                    return;
                }
                prefix = '>>';
                selectedText = imageId;
                suffix = 'p';
            } else {
                selectedText = hyperlink;
            }
            emptySelection = false;
        }

        box.value = beforeSelection + prefix + selectedText + suffix + trailingSpace + afterSelection;
        if (emptySelection) {
            box.selectionStart = beforeSelection.length + prefix.length;
        } else {
            box.selectionStart = beforeSelection.length + prefix.length + selectedText.length + suffix.length;
        }
        box.selectionEnd = box.selectionStart;
        box.scrollTop = scrollTop;
    }

    function initCSS(formats) {
        var ele;
        var stringBuilder = [];
        var styleElement = document.createElement('style');
        styleElement.id = 'dce-css';
        styleElement.type = 'text/css';
        stringBuilder.push('/* Generated by Derpibooru Comment Preview */');
        stringBuilder.push('.dce-toolbar {margin-bottom: 6px;}');
        stringBuilder.push('.dce-toolbar .button {height: 28px; min-width: 28px; text-align: center; vertical-align: middle; margin: 2px;}');
        for (ele in formats) {
            if (formats[ele].styleCSS !== undefined) {
                stringBuilder.push(`.dce-toolbar .button[formatting="${ele}"] {${formats[ele].styleCSS}}`);
            }
            if (formats[ele].glyph !== undefined) {
                stringBuilder.push(`.dce-toolbar .button[formatting="${ele}"]:before {content: "${formats[ele].glyph}"; font-size: 18px; vertical-align: middle;}`);
            }
        }
        styleElement.innerHTML = stringBuilder.join('\n');
        document.head.appendChild(styleElement);
    }

    function initToolbar(formats, textarea) {
        if (textarea.getAttribute('dce-toolbar') !== null) {
            return;
        }
        var commentBox = textarea;
        var toolbar = document.createElement('div');
        var ele;

        // HTML
        for (ele in formats) {
            if (formats[ele].displayText !== null) {
                var btn = document.createElement('div');
                var name = formats[ele].displayText;
                var altText = formats[ele].altText;
                var key = formats[ele].shortcutKey;

                btn.className = 'button';
                btn.innerHTML = name;
                if (altText !== undefined) {
                    if (key !== undefined) {
                        altText += ` (ctrl+${key})`;
                    }
                    btn.title = altText;
                }
                btn.setAttribute('formatting', ele);

                toolbar.appendChild(btn);
            }
        }
        toolbar.classList.add('dce-toolbar');
        commentBox.parentElement.insertBefore(toolbar, commentBox);

        // Event listeners
        toolbar.addEventListener('click', function (e) {
            if (e.target.matches('.button') || e.target.parentElement.matches('.button')) {
                var ele;
                var btn = (e.target.matches('.button')) ? e.target : e.target.parentElement;

                for (ele in formats) {
                    if (btn.getAttribute('formatting') == ele) {
                        formats[ele].edit(commentBox, formats[ele].options);
                    }
                }
                commentBox.focus();
            }
        });
        commentBox.addEventListener('keydown', function (e) {
            if (e.ctrlKey && !e.shiftKey) {
                var ele;
                var ch = e.key.toLowerCase();
                var box = e.target;

                for (ele in formats) {
                    if (ch == formats[ele].shortcutKey) {
                        formats[ele].edit(box, formats[ele].options);
                        e.preventDefault();
                    }
                }
            }
        });

        textarea.setAttribute('dce-toolbar', 1);
    }

    NodeCreationObserver.onCreation('article[id^="comment_"]', function (sourceCommentBody) {

        var links = sourceCommentBody.querySelectorAll('.communication__body__text a[href*="#comment_"]');
        var sourceCommentID = sourceCommentBody.id.slice(8);

        var ele = sourceCommentBody.querySelector('.communication__body__sender-name');
        var sourceAuthor = (ele.firstElementChild !== null && ele.firstElementChild.matches('a')) ? ele.firstElementChild.innerText : ele.innerHTML;

        links.forEach((link) => {

            var targetCommentID = link.hash.slice(9);    // Example: link.hash == "#comment_5430424"
            var backlink;

            // add backlink if the comment is not part of a quote
            // and not fetched
            if (!link.matches('blockquote a') && !sourceCommentBody.matches('.fetched-comment')) {

                backlink = document.createElement('a');

                backlink.style.marginRight = '5px';
                backlink.href = '#comment_' + sourceCommentID;
                backlink.textContent = '►';
                backlink.innerHTML += sourceAuthor;

                backlink.addEventListener('mouseenter', () => {
                    linkEnter(backlink, sourceCommentID);
                });
                backlink.addEventListener('mouseleave', () => {
                    linkLeave(backlink, sourceCommentID);
                });
                backlink.addEventListener('click', () => {
                    // force pageload instead of trying to navigate to a nonexistent anchor on the current page
                    if (document.getElementById('comment_' + sourceCommentID) === null) window.location.reload();
                });

                insertBacklink(backlink, targetCommentID);
            }


            // ignore quotes
            // this is terrible
            if (link.nextElementSibling &&
                    link.nextElementSibling.nextElementSibling &&
                    link.nextElementSibling.nextElementSibling.matches('blockquote')) return;

            link.addEventListener('mouseenter', () => {
                linkEnter(link, targetCommentID);
            });
            link.addEventListener('mouseleave', () => {
                linkLeave(link, targetCommentID);
            });

        });

        // If other pages had replied to this comment
        if (backlinksCache[sourceCommentID] !== undefined) {
            backlinksCache[sourceCommentID].forEach((backlink) => {
                insertBacklink(backlink, sourceCommentID);
            });
        }

    });

    // Comment loading
    NodeCreationObserver.onCreation('#image_comments nav>a.js-next', function (btnNextPage) {

        if (document.getElementById('comment_loading_button') !== null) return;

        var btnLastPage = btnNextPage.nextElementSibling;

        var imageId = getQueryVariable('id', btnNextPage);
        var nextPage = parseInt(getQueryVariable('page', btnNextPage), 10);
        var lastPage = parseInt(getQueryVariable('page', btnLastPage), 10);

        var btn = insertButton('Load more comments');

        btn.addEventListener('click', (e) => {
            loadComments(e, imageId, nextPage, lastPage);
        });

    });

    NodeCreationObserver.onCreation(textareaSelectors.join(','), function (textarea) {
        initToolbar(formattingSyntax, textarea);
    });

    initCSS(formattingSyntax);
})();
