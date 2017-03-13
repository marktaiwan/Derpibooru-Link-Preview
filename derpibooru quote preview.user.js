// ==UserScript==
// @name         Derpibooru Comment Preview
// @description  Hover preview for links to other comments
// @version      1.1.0
// @author       Marker
// @namespace    https://github.com/marktaiwan/
// @homepageURL  https://github.com/marktaiwan/Derpibooru-Link-Preview
// @supportURL   https://github.com/marktaiwan/Derpibooru-Link-Preview/issues
// @include      /^https?://(www\.)?(derpibooru\.org|trixiebooru\.org)/(images/)?\d{1,}(\?|\?.{1,}|/|\.html)?$/
// @include      /^https?://(www\.)?(derpibooru\.org|trixiebooru\.org)/lists/user_comments/\d{1,}(\?|\?.{1,}|/|\.html)?$/
// @include      /^https?://(www\.)?(derpibooru\.org|trixiebooru\.org)/lists/my_comments(\?|\?.{1,}|/|\.html)?$/
// @grant        none
// @require      https://openuserjs.org/src/libs/soufianesakhi/node-creation-observer.js
// ==/UserScript==

(function() {
    'use strict';

    function displayHover(comment, sourceLink) {
        const PADDING = 5; // in pixels

        comment = comment.cloneNode(true);
        comment.id = 'hover_preview';
        comment.style.position = 'absolute';
        comment.style.maxWidth = '980px';
        comment.style.minWidth = '490px';

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

    const HOVER_ATTRIBUTE = 'comment-preview-active';
    var fetchCache = {};
    var backlinksCache = {};

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
                    // force pageload instead of trying to navigate to a nonexistant anchor on the current page
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

})();
