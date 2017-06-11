// ==UserScript==
// @name         Derpibooru Comment Preview
// @description  Hover preview for links to other comments
// @version      1.3.0
// @author       Marker
// @namespace    https://github.com/marktaiwan/
// @homepageURL  https://github.com/marktaiwan/Derpibooru-Link-Preview
// @supportURL   https://github.com/marktaiwan/Derpibooru-Link-Preview/issues
// @include      /^https?://(www\.)?(derpibooru\.org|trixiebooru\.org)/(images/)?\d{1,}(\?|\?.{1,}|/|\.html)?$/
// @include      /^https?://(www\.)?(derpibooru\.org|trixiebooru\.org)/lists/user_comments/\d{1,}(\?|\?.{1,}|/|\.html)?$/
// @include      /^https?://(www\.)?(derpibooru\.org|trixiebooru\.org)/lists/my_comments(\?|\?.{1,}|/|\.html)?$/
// @include      /^https?://(www\.)?(derpibooru\.org|trixiebooru\.org)/(forums/)?(art|writing|dis|generals|pony|rp|meta|tagging|uppers)/?(.+)?$/
// @grant        none
// @require      https://openuserjs.org/src/libs/soufianesakhi/node-creation-observer.js
// ==/UserScript==

(function() {
    'use strict';

    const HOVER_ATTRIBUTE = 'comment-preview-active';
    var fetchCache = {};
    var backlinksCache = {};

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
            styleCSS: 'background-size: 22px; background-position: center; background-repeat: no-repeat; background-image: url(data:image/png;base64,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);',
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
            styleCSS: 'background-size: 20px; background-position: center; background-repeat: no-repeat; background-image: url(data:image/png;base64,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);',
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

    function initToolbar(formats) {
        var commentBox = document.querySelector('.js-preview-input');
        if (commentBox === null) {
            return;
        }
        var toolbar = document.createElement('div');
        var stringBuilder = [];
        var ele;

        // CSS
        var styleElement = document.createElement('style');
        styleElement.id = 'dcp-css';
        styleElement.type = 'text/css';
        stringBuilder.push('/* Generated by Derpibooru Comment Preview */');
        stringBuilder.push('#dcp-toolbar {margin-bottom: 6px;}');
        stringBuilder.push('#dcp-toolbar .button {height: 28px; min-width: 28px; text-align: center; vertical-align: middle; margin: 2px;}');
        for (ele in formats) {
            if (formats[ele].styleCSS !== undefined) {
                stringBuilder.push(`#dcp-toolbar .button[formatting="${ele}"] {${formats[ele].styleCSS}}`);
            }
        }
        styleElement.innerHTML = stringBuilder.join('\n');
        document.head.appendChild(styleElement);

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
        toolbar.id = 'dcp-toolbar';
        commentBox.parentElement.insertBefore(toolbar, commentBox);

        // Event listeners
        toolbar.addEventListener('click', function (e) {
            if (e.target.matches('.button') || e.target.parentElement.matches('.button')) {
                var ele;
                var btn = (e.target.matches('.button')) ? e.target : e.target.parentElement;
                var box = document.querySelector('.js-preview-input');

                for (ele in formattingSyntax) {
                    if (btn.getAttribute('formatting') == ele) {
                        formattingSyntax[ele].edit(box, formattingSyntax[ele].options);
                    }
                }
                box.focus();
            }
        });
        commentBox.addEventListener('keydown', function (e) {
            if (e.ctrlKey && !e.shiftKey) {
                var ch = e.key.toLowerCase();
                var formats = formattingSyntax;
                var ele;
                var box = e.target;

                for (ele in formats) {
                    if (ch == formats[ele].shortcutKey) {
                        formats[ele].edit(box, formats[ele].options);
                        e.preventDefault();
                    }
                }
            }
        });
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

    initToolbar(formattingSyntax);
})();
